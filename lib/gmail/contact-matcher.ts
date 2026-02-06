import type { SupabaseClient } from '@supabase/supabase-js';

export interface MatchResult {
  person_id: string | null;
  organization_id: string | null;
  project_id: string | null;
}

/**
 * Extract domain from an email address
 */
function extractDomain(email: string): string | null {
  const parts = email.split('@');
  if (parts.length !== 2 || !parts[1]) return null;
  const domain = parts[1].toLowerCase();
  // Ignore common free email providers for org matching
  const freeProviders = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
    'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com', 'yandex.com',
    'live.com', 'msn.com', 'me.com', 'mac.com', 'comcast.net',
  ];
  if (freeProviders.includes(domain)) return null;
  return domain;
}

/**
 * Get project IDs the user has access to
 */
async function getUserProjectIds(
  userId: string,
  supabase: SupabaseClient
): Promise<string[]> {
  const { data: memberships } = await supabase
    .from('project_memberships')
    .select('project_id')
    .eq('user_id', userId);

  return memberships?.map(m => m.project_id) ?? [];
}

/**
 * Match a single email address to CRM entities
 */
export async function matchEmailAddress(
  emailAddress: string,
  userId: string,
  supabase: SupabaseClient
): Promise<MatchResult> {
  const normalizedEmail = emailAddress.toLowerCase().trim();

  // Get user's accessible projects for scoping
  const projectIds = await getUserProjectIds(userId, supabase);
  if (projectIds.length === 0) {
    return { person_id: null, organization_id: null, project_id: null };
  }

  // 1. Try to match a person by email (scoped to user's projects)
  const { data: people } = await supabase
    .from('people')
    .select('id, project_id, email')
    .ilike('email', normalizedEmail)
    .in('project_id', projectIds)
    .is('deleted_at', null)
    .limit(1);

  const person = people?.[0];
  if (person) {
    // Look up the person's primary organization
    const { data: personOrgs } = await supabase
      .from('person_organizations')
      .select('organization_id')
      .eq('person_id', person.id)
      .eq('is_current', true)
      .order('is_primary', { ascending: false })
      .limit(1);

    return {
      person_id: person.id,
      organization_id: personOrgs?.[0]?.organization_id ?? null,
      project_id: person.project_id,
    };
  }

  // 2. Try domain match against organizations (scoped to user's projects)
  const domain = extractDomain(normalizedEmail);
  if (domain) {
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, project_id')
      .ilike('domain', domain)
      .in('project_id', projectIds)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(1);

    const org = orgs?.[0];
    if (org) {
      return {
        person_id: null,
        organization_id: org.id,
        project_id: org.project_id,
      };
    }
  }

  return { person_id: null, organization_id: null, project_id: null };
}

/**
 * Bulk match email addresses to CRM entities (for initial sync efficiency)
 * Avoids N+1 queries by batch-loading people and organizations
 */
export async function bulkMatchEmails(
  emailAddresses: string[],
  userId: string,
  supabase: SupabaseClient
): Promise<Map<string, MatchResult>> {
  const results = new Map<string, MatchResult>();
  const unique = [...new Set(emailAddresses.map(e => e.toLowerCase().trim()))];

  if (unique.length === 0) return results;

  // Get user's accessible projects for scoping
  const projectIds = await getUserProjectIds(userId, supabase);
  if (projectIds.length === 0) return results;

  // Batch query people by email (scoped to user's projects)
  const { data: people } = await supabase
    .from('people')
    .select('id, project_id, email')
    .in('email', unique)
    .in('project_id', projectIds)
    .is('deleted_at', null);

  const personByEmail = new Map<string, { id: string; project_id: string }>();
  if (people) {
    for (const p of people) {
      if (p.email) {
        personByEmail.set(p.email.toLowerCase(), { id: p.id, project_id: p.project_id });
      }
    }
  }

  // Get person→org mappings for matched people
  const matchedPersonIds = [...personByEmail.values()].map(p => p.id);
  const personOrgMap = new Map<string, string>();

  if (matchedPersonIds.length > 0) {
    const { data: personOrgs } = await supabase
      .from('person_organizations')
      .select('person_id, organization_id')
      .in('person_id', matchedPersonIds)
      .eq('is_current', true);

    if (personOrgs) {
      for (const po of personOrgs) {
        if (!personOrgMap.has(po.person_id)) {
          personOrgMap.set(po.person_id, po.organization_id);
        }
      }
    }
  }

  // Collect unmatched domains for org lookup
  const unmatchedDomains: string[] = [];
  for (const email of unique) {
    if (!personByEmail.has(email)) {
      const domain = extractDomain(email);
      if (domain) unmatchedDomains.push(domain);
    }
  }

  // Batch query organizations by domain (scoped to user's projects)
  const orgByDomain = new Map<string, { id: string; project_id: string }>();
  if (unmatchedDomains.length > 0) {
    const uniqueDomains = [...new Set(unmatchedDomains)];
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, project_id, domain')
      .in('domain', uniqueDomains)
      .in('project_id', projectIds)
      .is('deleted_at', null);

    if (orgs) {
      for (const org of orgs) {
        if (org.domain) {
          orgByDomain.set(org.domain.toLowerCase(), { id: org.id, project_id: org.project_id });
        }
      }
    }
  }

  // Build results
  for (const email of unique) {
    const person = personByEmail.get(email);
    if (person) {
      results.set(email, {
        person_id: person.id,
        organization_id: personOrgMap.get(person.id) ?? null,
        project_id: person.project_id,
      });
    } else {
      const domain = extractDomain(email);
      const org = domain ? orgByDomain.get(domain) : undefined;
      if (org) {
        results.set(email, {
          person_id: null,
          organization_id: org.id,
          project_id: org.project_id,
        });
      }
      // If no match, don't add to results — caller checks for absence
    }
  }

  return results;
}

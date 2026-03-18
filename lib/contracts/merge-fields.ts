import { createServiceClient } from '@/lib/supabase/server';
export { MERGE_FIELD_OPTIONS, VALID_MERGE_FIELD_KEYS } from '@/lib/contracts/merge-field-keys';

interface ResolveContext {
  projectId: string;
  personId?: string | null;
  organizationId?: string | null;
  opportunityId?: string | null;
}

/**
 * Resolves merge field keys to their current CRM values.
 * Returns a map of auto_populate_from key → resolved string value.
 */
export async function resolveMergeFields(
  keys: string[],
  context: ResolveContext
): Promise<Record<string, string>> {
  const supabase = createServiceClient();
  const result: Record<string, string> = {};

  const needsPerson = keys.some((k) => k.startsWith('person.'));
  const needsOrg = keys.some((k) => k.startsWith('organization.'));
  const needsOpp = keys.some((k) => k.startsWith('opportunity.'));

  // Fetch entities in parallel
  const [person, org, opp] = await Promise.all([
    needsPerson && context.personId
      ? supabase
          .from('people')
          .select('first_name, last_name, email, phone, job_title')
          .eq('id', context.personId)
          .eq('project_id', context.projectId)
          .is('deleted_at', null)
          .single()
          .then((r) => r.data)
      : null,
    needsOrg && context.organizationId
      ? supabase
          .from('organizations')
          .select('name, domain')
          .eq('id', context.organizationId)
          .eq('project_id', context.projectId)
          .is('deleted_at', null)
          .single()
          .then((r) => r.data)
      : null,
    needsOpp && context.opportunityId
      ? supabase
          .from('opportunities')
          .select('name, amount')
          .eq('id', context.opportunityId)
          .eq('project_id', context.projectId)
          .is('deleted_at', null)
          .single()
          .then((r) => r.data)
      : null,
  ]);

  for (const key of keys) {
    switch (key) {
      case 'person.full_name':
        if (person) result[key] = [person.first_name, person.last_name].filter(Boolean).join(' ');
        break;
      case 'person.email':
        if (person?.email) result[key] = person.email;
        break;
      case 'person.phone':
        if (person?.phone) result[key] = person.phone;
        break;
      case 'person.job_title':
        if (person?.job_title) result[key] = person.job_title;
        break;
      case 'organization.name':
        if (org?.name) result[key] = org.name;
        break;
      case 'organization.domain':
        if (org?.domain) result[key] = org.domain;
        break;
      case 'opportunity.name':
        if (opp?.name) result[key] = opp.name;
        break;
      case 'opportunity.amount':
        if (opp?.amount != null) result[key] = String(opp.amount);
        break;
      case 'date.today':
        result[key] = new Date().toISOString().split('T')[0]!;
        break;
    }
  }

  return result;
}

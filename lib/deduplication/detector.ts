import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DeduplicationEntityType,
  DetectionMatch,
  DetectionResult,
  MatchReason,
  PersonDetectionFields,
  OrganizationDetectionFields,
} from '@/types/deduplication';
import {
  FREE_EMAIL_PROVIDERS,
  ORG_NAME_SUFFIXES,
  PERSON_WEIGHTS,
  ORG_WEIGHTS,
  DEFAULT_MIN_THRESHOLD,
  FUZZY_NAME_THRESHOLD,
} from './constants';

// --- PostgREST filter sanitization ---

/** Escape double quotes and backslashes for safe interpolation into PostgREST .or() filter strings */
function sanitizeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// --- Normalization helpers ---

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function normalizePhone(phone: string): string {
  // Strip all non-digit characters, return last 10 digits
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export function normalizeOrgName(name: string): string {
  let normalized = name.toLowerCase().trim();
  // Remove common suffixes (with optional leading comma)
  for (const suffix of ORG_NAME_SUFFIXES) {
    const escapedSuffix = suffix.replace(/\./g, '\\.');
    const pattern = new RegExp(`[,\\s]+${escapedSuffix}$`, 'i');
    normalized = normalized.replace(pattern, '');
  }
  return normalized.trim();
}

export function extractLinkedInId(url: string): string | null {
  try {
    const normalized = url.toLowerCase().trim();
    // Match /in/username or /company/name patterns
    const personMatch = normalized.match(/linkedin\.com\/in\/([^/?#]+)/);
    if (personMatch?.[1]) return personMatch[1];
    const companyMatch = normalized.match(/linkedin\.com\/company\/([^/?#]+)/);
    if (companyMatch?.[1]) return companyMatch[1];
    return null;
  } catch {
    return null;
  }
}

export function extractDomainFromEmail(email: string): string | null {
  const parts = email.split('@');
  if (parts.length !== 2 || !parts[1]) return null;
  const domain = parts[1].toLowerCase();
  if (FREE_EMAIL_PROVIDERS.includes(domain as typeof FREE_EMAIL_PROVIDERS[number])) return null;
  return domain;
}

export function extractDomainFromUrl(url: string): string | null {
  try {
    let normalized = url.trim().toLowerCase();
    if (!normalized.startsWith('http')) normalized = `https://${normalized}`;
    const parsed = new URL(normalized);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

// --- Jaro-Winkler similarity ---

export function jaroWinkler(s1: string, s2: string): number {
  const a = s1.toLowerCase();
  const b = s2.toLowerCase();

  if (a === b) return 1.0;
  if (a.length === 0 || b.length === 0) return 0.0;

  const matchDistance = Math.max(Math.floor(Math.max(a.length, b.length) / 2) - 1, 0);
  const aMatches = new Array(a.length).fill(false);
  const bMatches = new Array(b.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);

    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (k < b.length && !bMatches[k]) k++;
    if (k >= b.length) break;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;

  // Winkler modification: boost for common prefix
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(a.length, b.length)); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

// --- Detection engine ---

interface DetectionConfig {
  entityType: DeduplicationEntityType;
  projectId: string;
  excludeIds?: string[];
  minThreshold?: number;
}

export async function detectPersonDuplicates(
  record: PersonDetectionFields,
  config: DetectionConfig,
  supabase: SupabaseClient
): Promise<DetectionMatch[]> {
  const { projectId, excludeIds = [], minThreshold = DEFAULT_MIN_THRESHOLD } = config;
  const matches: DetectionMatch[] = [];

  // Build candidate set: query people who share at least one anchor field
  const orFilters: string[] = [];
  const normalizedEmail = record.email ? normalizeEmail(record.email) : null;

  if (normalizedEmail) {
    orFilters.push(`email.ilike."${sanitizeFilterValue(normalizedEmail)}"`);
  }

  if (record.linkedin_url) {
    const linkedInId = extractLinkedInId(record.linkedin_url);
    if (linkedInId) {
      orFilters.push(`linkedin_url.ilike."%${sanitizeFilterValue(linkedInId)}%"`);
    }
  }

  if (record.phone) {
    const normalizedPhone = normalizePhone(record.phone);
    if (normalizedPhone.length >= 7) {
      orFilters.push(`phone.ilike."%${sanitizeFilterValue(normalizedPhone.slice(-7))}%"`);
    }
  }

  if (record.mobile_phone) {
    const normalizedMobile = normalizePhone(record.mobile_phone);
    if (normalizedMobile.length >= 7) {
      orFilters.push(`mobile_phone.ilike."%${sanitizeFilterValue(normalizedMobile.slice(-7))}%"`);
    }
  }

  // Also search by email domain for domain+name matching
  const emailDomain = normalizedEmail ? extractDomainFromEmail(normalizedEmail) : null;
  if (emailDomain) {
    orFilters.push(`email.ilike."%@${sanitizeFilterValue(emailDomain)}"`);
  }

  if (orFilters.length === 0) {
    // No anchor fields to match on — fall back to name-only if we have a name
    if (!record.first_name && !record.last_name) return [];
    // Name-only matching requires scanning more records; limit scope
    const { data: candidates } = await supabase
      .from('people')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .limit(200);

    if (candidates) {
      for (const candidate of candidates) {
        if (excludeIds.includes(candidate.id)) continue;
        const { score, reasons } = scorePersonMatch(record, candidate);
        if (score >= minThreshold) {
          matches.push({ target_id: candidate.id, record: candidate as Record<string, unknown>, score, reasons });
        }
      }
    }
    return matches.sort((a, b) => b.score - a.score);
  }

  const { data: candidates } = await supabase
    .from('people')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .or(orFilters.join(','))
    .limit(50);

  if (!candidates) return [];

  for (const candidate of candidates) {
    if (excludeIds.includes(candidate.id)) continue;
    const { score, reasons } = scorePersonMatch(record, candidate);
    if (score >= minThreshold) {
      matches.push({ target_id: candidate.id, record: candidate as Record<string, unknown>, score, reasons });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

export async function detectOrganizationDuplicates(
  record: OrganizationDetectionFields,
  config: DetectionConfig,
  supabase: SupabaseClient
): Promise<DetectionMatch[]> {
  const { projectId, excludeIds = [], minThreshold = DEFAULT_MIN_THRESHOLD } = config;
  const matches: DetectionMatch[] = [];

  const orFilters: string[] = [];

  if (record.domain) {
    orFilters.push(`domain.ilike."${sanitizeFilterValue(record.domain.toLowerCase())}"`);
  }

  if (record.website) {
    const websiteDomain = extractDomainFromUrl(record.website);
    if (websiteDomain) {
      orFilters.push(`domain.ilike."${sanitizeFilterValue(websiteDomain)}"`);
      orFilters.push(`website.ilike."%${sanitizeFilterValue(websiteDomain)}%"`);
    }
  }

  if (record.linkedin_url) {
    const linkedInId = extractLinkedInId(record.linkedin_url);
    if (linkedInId) {
      orFilters.push(`linkedin_url.ilike."%${sanitizeFilterValue(linkedInId)}%"`);
    }
  }

  if (record.name) {
    const normalized = normalizeOrgName(record.name);
    if (normalized.length >= 3) {
      orFilters.push(`name.ilike."%${sanitizeFilterValue(normalized)}%"`);
    }
  }

  if (orFilters.length === 0) return [];

  const { data: candidates } = await supabase
    .from('organizations')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .or(orFilters.join(','))
    .limit(50);

  if (!candidates) return [];

  for (const candidate of candidates) {
    if (excludeIds.includes(candidate.id)) continue;
    const { score, reasons } = scoreOrganizationMatch(record, candidate);
    if (score >= minThreshold) {
      matches.push({ target_id: candidate.id, record: candidate as Record<string, unknown>, score, reasons });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

// Unified entry point
export async function detectDuplicates(
  record: PersonDetectionFields | OrganizationDetectionFields,
  config: DetectionConfig,
  supabase: SupabaseClient
): Promise<DetectionResult> {
  const matches =
    config.entityType === 'person'
      ? await detectPersonDuplicates(record as PersonDetectionFields, config, supabase)
      : await detectOrganizationDuplicates(record as OrganizationDetectionFields, config, supabase);

  return {
    has_duplicates: matches.length > 0,
    matches,
  };
}

// --- Scoring functions ---

export function scorePersonMatch(
  incoming: PersonDetectionFields,
  existing: Record<string, unknown>
): { score: number; reasons: MatchReason[] } {
  const reasons: MatchReason[] = [];
  let totalScore = 0;

  // Email match (exact, normalized)
  if (incoming.email && existing.email) {
    const inEmail = normalizeEmail(incoming.email);
    const exEmail = normalizeEmail(existing.email as string);
    if (inEmail === exEmail) {
      totalScore += PERSON_WEIGHTS.email;
      reasons.push({
        field: 'email',
        match_type: 'exact',
        source_value: incoming.email,
        target_value: existing.email as string,
        contribution: PERSON_WEIGHTS.email,
      });
    }
  }

  // LinkedIn URL match (normalized ID)
  if (incoming.linkedin_url && existing.linkedin_url) {
    const inId = extractLinkedInId(incoming.linkedin_url);
    const exId = extractLinkedInId(existing.linkedin_url as string);
    if (inId && exId && inId === exId) {
      totalScore += PERSON_WEIGHTS.linkedin_url;
      reasons.push({
        field: 'linkedin_url',
        match_type: 'normalized',
        source_value: incoming.linkedin_url,
        target_value: existing.linkedin_url as string,
        contribution: PERSON_WEIGHTS.linkedin_url,
      });
    }
  }

  // Phone match (normalized)
  const inPhone = incoming.phone ? normalizePhone(incoming.phone) : null;
  const inMobile = incoming.mobile_phone ? normalizePhone(incoming.mobile_phone) : null;
  const exPhone = existing.phone ? normalizePhone(existing.phone as string) : null;
  const exMobile = existing.mobile_phone ? normalizePhone(existing.mobile_phone as string) : null;

  const phoneMatched =
    (inPhone && exPhone && inPhone === exPhone) ||
    (inPhone && exMobile && inPhone === exMobile) ||
    (inMobile && exPhone && inMobile === exPhone) ||
    (inMobile && exMobile && inMobile === exMobile);

  if (phoneMatched) {
    totalScore += PERSON_WEIGHTS.phone;
    reasons.push({
      field: 'phone',
      match_type: 'normalized',
      source_value: incoming.phone || incoming.mobile_phone || '',
      target_value: (existing.phone || existing.mobile_phone || '') as string,
      contribution: PERSON_WEIGHTS.phone,
    });
  }

  // Name match (fuzzy)
  const inName = [incoming.first_name, incoming.last_name].filter(Boolean).join(' ');
  const exName = [existing.first_name, existing.last_name].filter(Boolean).join(' ');

  if (inName && exName) {
    const nameSimilarity = jaroWinkler(inName, exName);
    if (nameSimilarity >= FUZZY_NAME_THRESHOLD) {
      totalScore += PERSON_WEIGHTS.name;
      reasons.push({
        field: 'name',
        match_type: 'fuzzy',
        source_value: inName,
        target_value: exName,
        contribution: PERSON_WEIGHTS.name,
      });
    }

    // Domain + name combined match
    if (incoming.email && existing.email) {
      const inDomain = extractDomainFromEmail(normalizeEmail(incoming.email));
      const exDomain = extractDomainFromEmail(normalizeEmail(existing.email as string));
      if (inDomain && exDomain && inDomain === exDomain && nameSimilarity >= 0.75) {
        // Lower name threshold when same domain
        totalScore += PERSON_WEIGHTS.domain_name;
        reasons.push({
          field: 'domain+name',
          match_type: 'domain',
          source_value: `${inDomain} / ${inName}`,
          target_value: `${exDomain} / ${exName}`,
          contribution: PERSON_WEIGHTS.domain_name,
        });
      }
    }
  }

  // Cap at 1.0
  return { score: Math.min(totalScore, 1.0), reasons };
}

export function scoreOrganizationMatch(
  incoming: OrganizationDetectionFields,
  existing: Record<string, unknown>
): { score: number; reasons: MatchReason[] } {
  const reasons: MatchReason[] = [];
  let totalScore = 0;

  // Domain match (exact)
  const inDomain = incoming.domain?.toLowerCase().trim();
  const exDomain = (existing.domain as string | null)?.toLowerCase().trim();

  if (inDomain && exDomain && inDomain === exDomain) {
    totalScore += ORG_WEIGHTS.domain;
    reasons.push({
      field: 'domain',
      match_type: 'exact',
      source_value: incoming.domain!,
      target_value: existing.domain as string,
      contribution: ORG_WEIGHTS.domain,
    });
  }

  // Website → domain comparison
  if (!inDomain || !exDomain || inDomain !== exDomain) {
    const inWebDomain = incoming.website ? extractDomainFromUrl(incoming.website) : null;
    const exWebDomain = existing.website ? extractDomainFromUrl(existing.website as string) : null;
    const domainA = inDomain || inWebDomain;
    const domainB = exDomain || exWebDomain;

    if (domainA && domainB && domainA === domainB) {
      totalScore += ORG_WEIGHTS.website;
      reasons.push({
        field: 'website',
        match_type: 'domain',
        source_value: incoming.website || incoming.domain || '',
        target_value: (existing.website || existing.domain || '') as string,
        contribution: ORG_WEIGHTS.website,
      });
    }
  }

  // LinkedIn match
  if (incoming.linkedin_url && existing.linkedin_url) {
    const inId = extractLinkedInId(incoming.linkedin_url);
    const exId = extractLinkedInId(existing.linkedin_url as string);
    if (inId && exId && inId === exId) {
      totalScore += ORG_WEIGHTS.linkedin_url;
      reasons.push({
        field: 'linkedin_url',
        match_type: 'normalized',
        source_value: incoming.linkedin_url,
        target_value: existing.linkedin_url as string,
        contribution: ORG_WEIGHTS.linkedin_url,
      });
    }
  }

  // Name match (fuzzy, after stripping suffixes)
  if (incoming.name && existing.name) {
    const inNorm = normalizeOrgName(incoming.name);
    const exNorm = normalizeOrgName(existing.name as string);
    const similarity = jaroWinkler(inNorm, exNorm);
    if (similarity >= FUZZY_NAME_THRESHOLD) {
      totalScore += ORG_WEIGHTS.name;
      reasons.push({
        field: 'name',
        match_type: 'fuzzy',
        source_value: incoming.name,
        target_value: existing.name as string,
        contribution: ORG_WEIGHTS.name,
      });
    }
  }

  return { score: Math.min(totalScore, 1.0), reasons };
}

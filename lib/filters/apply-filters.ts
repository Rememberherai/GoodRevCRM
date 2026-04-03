import type { FilterCondition, DateRangeValue } from '@/types/filters';
import type { SupabaseClient } from '@supabase/supabase-js';

// Whitelist of allowed direct filter fields per entity
const ALLOWED_PEOPLE_FIELDS = new Set([
  'created_at', 'updated_at', 'disposition_id',
  'is_contractor', 'is_employee',
  'address_city', 'address_state', 'address_country',
]);

const ALLOWED_ORG_FIELDS = new Set([
  'created_at', 'updated_at', 'disposition_id',
  'is_customer', 'is_vendor', 'is_referral_partner',
  'industry', 'address_city', 'address_state', 'address_country',
]);

// Fields allowed for cross-entity org filtering (on people)
const ALLOWED_ORG_RELATION_FIELDS = new Set([
  'industry', 'is_customer', 'is_vendor', 'is_referral_partner',
  'address_city', 'address_state', 'address_country',
]);

export function parseFiltersParam(raw: string | null): FilterCondition[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f: unknown) =>
        f && typeof f === 'object' &&
        'field' in (f as Record<string, unknown>) &&
        'operator' in (f as Record<string, unknown>)
    ) as FilterCondition[];
  } catch {
    return [];
  }
}

/**
 * Apply direct field filters to a Supabase query.
 * Returns the modified query.
 */
export function applyDirectFilters<T>(
  query: T,
  filters: FilterCondition[],
  allowedFields: Set<string>,
): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = query as any;

  for (const filter of filters) {
    // Skip relation filters (handled separately)
    if (filter.field.startsWith('org.')) continue;
    if (!allowedFields.has(filter.field)) continue;
    if (filter.value === undefined || filter.value === null) continue;

    switch (filter.operator) {
      case 'between': {
        const range = filter.value as DateRangeValue;
        if (range.from && range.to) {
          q = q.gte(filter.field, range.from).lte(filter.field, range.to);
        }
        break;
      }
      case 'eq':
        q = q.eq(filter.field, filter.value);
        break;
      case 'neq':
        q = q.neq(filter.field, filter.value);
        break;
      case 'in': {
        const vals = filter.value as string[];
        if (vals.length > 0) {
          q = q.in(filter.field, vals);
        }
        break;
      }
      case 'ilike': {
        const text = filter.value as string;
        if (text) {
          const sanitized = text.replace(/[%_\\]/g, '\\$&');
          q = q.ilike(filter.field, `%${sanitized}%`);
        }
        break;
      }
      case 'is_null':
        q = q.is(filter.field, null);
        break;
      case 'is_not_null':
        q = q.not(filter.field, 'is', null);
        break;
    }
  }

  return q as T;
}

/**
 * Resolve cross-entity org filters for People queries.
 * Returns an array of person IDs that match the org filters,
 * or null if there are no org filters.
 */
export async function resolveOrgRelationFilters(
  supabase: SupabaseClient,
  projectId: string,
  filters: FilterCondition[],
): Promise<string[] | null> {
  const orgFilters = filters.filter(
    (f) => f.field.startsWith('org.') && f.value !== undefined && f.value !== null
  );
  if (orgFilters.length === 0) return null;

  // Build a query on the organizations table with all org filters
  let orgQuery = supabase
    .from('organizations')
    .select('id')
    .eq('project_id', projectId)
    .is('deleted_at', null);

  for (const filter of orgFilters) {
    const orgField = filter.field.replace('org.', '');
    if (!ALLOWED_ORG_RELATION_FIELDS.has(orgField)) continue;

    switch (filter.operator) {
      case 'eq':
        orgQuery = orgQuery.eq(orgField, filter.value);
        break;
      case 'ilike': {
        const text = filter.value as string;
        if (text) {
          const sanitized = text.replace(/[%_\\]/g, '\\$&');
          orgQuery = orgQuery.ilike(orgField, `%${sanitized}%`);
        }
        break;
      }
      case 'in': {
        const vals = filter.value as string[];
        if (vals.length > 0) {
          orgQuery = orgQuery.in(orgField, vals);
        }
        break;
      }
    }
  }

  const { data: matchingOrgs } = await orgQuery;
  if (!matchingOrgs || matchingOrgs.length === 0) return [];

  const orgIds = matchingOrgs.map((o: { id: string }) => o.id);

  // Get person IDs linked to those orgs
  const { data: personOrgs } = await supabase
    .from('person_organizations')
    .select('person_id')
    .in('organization_id', orgIds)
    .eq('project_id', projectId);

  if (!personOrgs || personOrgs.length === 0) return [];

  return [...new Set(personOrgs.map((po: { person_id: string }) => po.person_id))];
}

export { ALLOWED_PEOPLE_FIELDS, ALLOWED_ORG_FIELDS };

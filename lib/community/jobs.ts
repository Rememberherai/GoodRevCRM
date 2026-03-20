import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Supabase = SupabaseClient<Database>;

export interface ScopeMatchInput {
  serviceCategory?: string | null;
  requiredCertifications?: string[] | null;
  serviceLatitude?: number | null;
  serviceLongitude?: number | null;
}

export interface ContractorScopeMatch {
  matches: boolean;
  reason: string | null;
  scopeId: string | null;
}

type ScopeRow = {
  id: string;
  status: string;
  service_categories: string[];
  certifications: string[];
  service_area_radius_miles: number | null;
  home_base_latitude: number | null;
  home_base_longitude: number | null;
};

function toSet(values: string[] | null | undefined) {
  return new Set((values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function milesBetweenPoints(latA: number, lngA: number, latB: number, lngB: number) {
  const avgLatRad = ((latA + latB) / 2) * (Math.PI / 180);
  const dx = (latA - latB) * 69;
  const dy = (lngA - lngB) * 69 * Math.cos(avgLatRad);
  return Math.sqrt(dx * dx + dy * dy);
}

function matchesScope(scope: ScopeRow, input: ScopeMatchInput) {
  if (scope.status !== 'active') {
    return { matches: false, reason: 'Contractor does not have an active scope of work.' };
  }

  if (input.serviceCategory) {
    const categories = toSet(scope.service_categories);
    if (categories.size > 0 && !categories.has(input.serviceCategory.trim().toLowerCase())) {
      return { matches: false, reason: 'Job service category is outside the contractor scope.' };
    }
  }

  const requiredCertifications = toSet(input.requiredCertifications);
  if (requiredCertifications.size > 0) {
    const scopeCertifications = toSet(scope.certifications);
    for (const certification of requiredCertifications) {
      if (!scopeCertifications.has(certification)) {
        return { matches: false, reason: `Missing required certification: ${certification}.` };
      }
    }
  }

  if (
    scope.service_area_radius_miles != null
    && scope.home_base_latitude != null
    && scope.home_base_longitude != null
    && input.serviceLatitude != null
    && input.serviceLongitude != null
  ) {
    const milesAway = milesBetweenPoints(
      scope.home_base_latitude,
      scope.home_base_longitude,
      input.serviceLatitude,
      input.serviceLongitude
    );
    if (milesAway > scope.service_area_radius_miles) {
      return { matches: false, reason: 'Job service location is outside the contractor service area.' };
    }
  }

  return { matches: true, reason: null };
}

export async function checkContractorScopeMatch(
  supabase: Supabase,
  projectId: string,
  contractorId: string,
  input: ScopeMatchInput
): Promise<ContractorScopeMatch> {
  const { data: scopes, error } = await supabase
    .from('contractor_scopes')
    .select('id, status, service_categories, certifications, service_area_radius_miles, home_base_latitude, home_base_longitude')
    .eq('project_id', projectId)
    .eq('contractor_id', contractorId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load contractor scopes: ${error.message}`);
  }

  const activeScopes = scopes ?? [];
  if (activeScopes.length === 0) {
    return {
      matches: false,
      reason: 'Contractor does not have a scope of work on file.',
      scopeId: null,
    };
  }

  for (const scope of activeScopes) {
    const result = matchesScope(scope, input);
    if (result.matches) {
      return {
        matches: true,
        reason: null,
        scopeId: scope.id,
      };
    }
  }

  const fallbackReason = matchesScope(activeScopes[0]!, input).reason;
  return {
    matches: false,
    reason: fallbackReason,
    scopeId: activeScopes[0]!.id,
  };
}

export function computeTimeEntryDurationMinutes(startedAt: string, endedAt: string | null) {
  if (!endedAt) return null;
  const diff = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  return Math.max(0, Math.round(diff / 60000));
}

export function sortJobsForWorkPlan<T extends {
  priority?: string | null;
  deadline?: string | null;
  desired_start?: string | null;
}>(jobs: T[]) {
  const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return [...jobs].sort((a, b) => {
    const priorityA = priorityRank[a.priority ?? 'medium'] ?? 1;
    const priorityB = priorityRank[b.priority ?? 'medium'] ?? 1;
    if (priorityA !== priorityB) return priorityA - priorityB;

    const deadlineA = a.deadline ? new Date(a.deadline).getTime() : Number.POSITIVE_INFINITY;
    const deadlineB = b.deadline ? new Date(b.deadline).getTime() : Number.POSITIVE_INFINITY;
    if (deadlineA !== deadlineB) return deadlineA - deadlineB;

    const startA = a.desired_start ? new Date(a.desired_start).getTime() : Number.POSITIVE_INFINITY;
    const startB = b.desired_start ? new Date(b.desired_start).getTime() : Number.POSITIVE_INFINITY;
    return startA - startB;
  });
}

export function formatWorkPlanLines<T extends {
  title?: string | null;
  priority?: string | null;
  desired_start?: string | null;
  deadline?: string | null;
}>(jobs: T[]) {
  return sortJobsForWorkPlan(jobs).map((job, index) => {
    const parts = [
      `${index + 1}. ${job.title ?? 'Untitled job'}`,
      job.priority ? `priority ${job.priority}` : null,
      job.desired_start ? `start ${new Date(job.desired_start).toLocaleString()}` : null,
      job.deadline ? `deadline ${new Date(job.deadline).toLocaleString()}` : null,
    ].filter(Boolean);
    return parts.join(' • ');
  });
}

import { checkCommunityPermission } from '@/lib/projects/community-permissions';
import type { ProjectRole } from '@/types/user';

export type IncidentVisibility = 'operations' | 'case_management' | 'private';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any;

export function canAccessSensitiveCaseData(role: ProjectRole, action: 'view' | 'create' | 'update' | 'delete' = 'view') {
  return checkCommunityPermission(role, 'cases', action);
}

export function normalizeIncidentVisibility(
  requested: unknown,
  role: ProjectRole,
  action: 'create' | 'update'
): IncidentVisibility {
  const fallback: IncidentVisibility = 'operations';
  const parsed = requested === 'private' || requested === 'case_management' || requested === 'operations'
    ? requested
    : fallback;

  if (canAccessSensitiveCaseData(role, action)) {
    return parsed;
  }

  return 'operations';
}

export async function ensureProjectEntity(
  supabase: SupabaseLike,
  table: string,
  id: string,
  projectId: string,
  options: { nullableDeletedAt?: boolean } = {}
) {
  let query = supabase
    .from(table)
    .select('id')
    .eq('id', id)
    .eq('project_id', projectId);

  if (options.nullableDeletedAt !== false) {
    query = query.is('deleted_at', null);
  }

  const { data } = await query.single();
  return Boolean(data);
}

export async function ensureProjectUserMembership(supabase: SupabaseLike, userId: string, projectId: string) {
  const { data } = await supabase
    .from('project_memberships')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single();

  return Boolean(data);
}

export async function createHouseholdCaseEvent(
  supabase: SupabaseLike,
  input: {
    caseId: string;
    householdId: string;
    projectId: string;
    eventType: 'opened' | 'assigned' | 'status_changed' | 'follow_up_scheduled' | 'contact_logged' | 'goal_completed' | 'closed' | 'reopened';
    summary: string;
    createdBy?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  await supabase.from('household_case_events').insert({
    case_id: input.caseId,
    household_id: input.householdId,
    project_id: input.projectId,
    event_type: input.eventType,
    summary: input.summary,
    created_by: input.createdBy ?? null,
    metadata: input.metadata ?? {},
  });
}

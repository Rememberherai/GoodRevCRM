import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { ProjectRole, StandardProjectRole } from '@/types/user';

const STANDARD_PROJECT_ROLES = ['viewer', 'member', 'admin', 'owner'] as const;

const ROLE_RANK: Record<StandardProjectRole, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

export type StandardResource =
  | 'dashboard'
  | 'contacts'
  | 'pipelines'
  | 'grants'
  | 'reports'
  | 'automations'
  | 'settings';

export class ProjectAccessError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = 'ProjectAccessError';
    this.status = status;
  }
}

/**
 * Fetch a single override for a user+project+resource.
 * Returns true (granted), false (denied), or null (no override — fall back to role logic).
 */
export async function getOverride(
  supabase: SupabaseClient<Database>,
  userId: string,
  projectId: string,
  resource: string
): Promise<boolean | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('project_membership_overrides')
    .select('granted')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('resource', resource)
    .maybeSingle();
  if (error) throw error;
  if (data == null) return null;
  return (data as { granted: boolean }).granted;
}

export async function requireProjectRole(
  supabase: SupabaseClient<Database>,
  userId: string,
  projectId: string,
  requiredRole: StandardProjectRole,
  resource?: StandardResource
): Promise<ProjectRole> {
  const { data: membership, error } = await supabase
    .from('project_memberships')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single();

  if (error || !membership) {
    throw new ProjectAccessError('Access denied');
  }

  const role = membership.role as ProjectRole;
  if (!STANDARD_PROJECT_ROLES.includes(role as StandardProjectRole)) {
    throw new ProjectAccessError(`Standard project role required. Current role '${role}' is community-only.`);
  }

  const standardRole = role as StandardProjectRole;

  // Check override if a resource was specified
  if (resource !== undefined) {
    const override = await getOverride(supabase, userId, projectId, resource);
    if (override === true) return role;
    if (override === false) throw new ProjectAccessError(`Access to '${resource}' is restricted`);
    // null → fall through to rank check
  }

  if (ROLE_RANK[standardRole] < ROLE_RANK[requiredRole]) {
    throw new ProjectAccessError(`${requiredRole[0]!.toUpperCase()}${requiredRole.slice(1)} role required`);
  }

  return role;
}

/**
 * Verify a user is a project member and not explicitly denied a resource.
 * Does not require a minimum role rank — any member passes unless denied by override.
 */
export async function requireAnyProjectPermission(
  supabase: SupabaseClient<Database>,
  userId: string,
  projectId: string,
  resource: StandardResource
): Promise<ProjectRole> {
  const { data: membership, error } = await supabase
    .from('project_memberships')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single();

  if (error || !membership) {
    throw new ProjectAccessError('Access denied');
  }

  const role = membership.role as ProjectRole;

  const override = await getOverride(supabase, userId, projectId, resource);
  if (override === false) throw new ProjectAccessError(`Access to '${resource}' is restricted`);

  return role;
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { ProjectRole } from '@/types/user';

const ROLE_RANK: Record<ProjectRole, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

export class ProjectAccessError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = 'ProjectAccessError';
    this.status = status;
  }
}

export async function requireProjectRole(
  supabase: SupabaseClient<Database>,
  userId: string,
  projectId: string,
  requiredRole: ProjectRole
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
  if (ROLE_RANK[role] < ROLE_RANK[requiredRole]) {
    throw new ProjectAccessError(`${requiredRole[0]!.toUpperCase()}${requiredRole.slice(1)} role required`);
  }

  return role;
}

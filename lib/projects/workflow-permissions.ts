import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { ProjectRole } from '@/types/user';
import { ProjectAccessError } from './permissions';
import { requireCommunityPermission, type CommunityAction } from './community-permissions';

type WorkflowAction = 'view' | 'create' | 'update' | 'delete' | 'manage' | 'execute';

export async function requireWorkflowPermission(
  supabase: SupabaseClient<Database>,
  userId: string,
  project: { id: string; project_type?: string | null },
  action: WorkflowAction,
): Promise<ProjectRole> {
  if (project.project_type === 'community') {
    const communityAction: CommunityAction =
      action === 'execute'
        ? 'manage'
        : action;
    return requireCommunityPermission(supabase, userId, project.id, 'workflows', communityAction);
  }

  const { data: membership, error } = await supabase
    .from('project_memberships')
    .select('role')
    .eq('project_id', project.id)
    .eq('user_id', userId)
    .single();

  if (error || !membership) {
    throw new ProjectAccessError('Access denied');
  }

  const role = membership.role as ProjectRole;

  if (action === 'view') return role;

  if (action === 'create' || action === 'update' || action === 'execute') {
    if (['owner', 'admin', 'member'].includes(role)) return role;
    throw new ProjectAccessError('Member role or above required');
  }

  if (action === 'delete' || action === 'manage') {
    if (['owner', 'admin'].includes(role)) return role;
    throw new ProjectAccessError('Admin role required');
  }

  throw new ProjectAccessError('Access denied');
}

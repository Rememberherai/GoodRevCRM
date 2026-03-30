import { createClient } from '@/lib/supabase/server';
import { requireCommunityPermission, type CommunityAction, type CommunityResource } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import type { ProjectRole } from '@/types/user';

export async function getProjectBySlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slug: string
) {
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, slug, project_type')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (error || !project) {
    return null;
  }

  return project;
}

export async function getAuthenticatedUser(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getProjectMembershipRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  projectId: string
): Promise<ProjectRole | null> {
  const { data: membership, error } = await supabase
    .from('project_memberships')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single();

  if (error || !membership) {
    return null;
  }

  return membership.role as ProjectRole;
}

export async function canAccessCommunityResource(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  projectId: string,
  resource: CommunityResource,
  action: CommunityAction
) {
  try {
    await requireCommunityPermission(supabase, userId, projectId, resource, action);
    return true;
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return false;
    }
    throw error;
  }
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { ProjectRole } from '@/types/user';
import { ProjectAccessError, getOverride } from './permissions';

export type CommunityResource =
  | 'households'
  | 'intake'
  | 'programs'
  | 'contributions'
  | 'community_assets'
  | 'risk_scores'
  | 'referrals'
  | 'relationships'
  | 'broadcasts'
  | 'grants'
  | 'jobs'
  | 'assistant_ap'
  | 'dashboard'
  | 'reports'
  | 'settings'
  | 'public_dashboard'
  | 'events'
  | 'asset_access';

export type CommunityAction = 'view' | 'create' | 'update' | 'delete' | 'export_pii' | 'manage';

const NO_ACTIONS: readonly CommunityAction[] = [];

const COMMUNITY_PERMISSION_MATRIX: Record<ProjectRole, Record<CommunityResource, readonly CommunityAction[]>> = {
  owner: {
    households: ['view', 'create', 'update', 'delete'],
    intake: ['view', 'create', 'update', 'delete'],
    programs: ['view', 'create', 'update', 'delete'],
    contributions: ['view', 'create', 'update', 'delete'],
    community_assets: ['view', 'create', 'update', 'delete'],
    risk_scores: ['view', 'update'],
    referrals: ['view', 'create', 'update', 'delete'],
    relationships: ['view', 'create', 'update', 'delete'],
    broadcasts: ['view', 'create', 'update', 'delete'],
    grants: ['view', 'create', 'update', 'delete'],
    jobs: ['view', 'create', 'update', 'delete'],
    assistant_ap: ['view', 'create', 'update', 'delete'],
    dashboard: ['view'],
    reports: ['view', 'export_pii'],
    settings: ['view', 'update'],
    public_dashboard: ['manage'],
    events: ['view', 'create', 'update', 'delete', 'export_pii', 'manage'],
    asset_access: ['view', 'manage'],
  },
  admin: {
    households: ['view', 'create', 'update', 'delete'],
    intake: ['view', 'create', 'update', 'delete'],
    programs: ['view', 'create', 'update', 'delete'],
    contributions: ['view', 'create', 'update', 'delete'],
    community_assets: ['view', 'create', 'update', 'delete'],
    risk_scores: ['view', 'update'],
    referrals: ['view', 'create', 'update', 'delete'],
    relationships: ['view', 'create', 'update', 'delete'],
    broadcasts: ['view', 'create', 'update', 'delete'],
    grants: ['view', 'create', 'update', 'delete'],
    jobs: ['view', 'create', 'update', 'delete'],
    assistant_ap: ['view', 'create', 'update', 'delete'],
    dashboard: ['view'],
    reports: ['view', 'export_pii'],
    settings: ['view', 'update'],
    public_dashboard: ['manage'],
    events: ['view', 'create', 'update', 'delete', 'export_pii', 'manage'],
    asset_access: ['view', 'manage'],
  },
  staff: {
    households: ['view', 'create', 'update', 'delete'],
    intake: NO_ACTIONS,
    programs: ['view', 'create', 'update', 'delete'],
    contributions: ['view', 'create', 'update', 'delete'],
    community_assets: ['view', 'create', 'update', 'delete'],
    risk_scores: ['view'],
    referrals: ['view', 'create', 'update', 'delete'],
    relationships: ['view', 'create', 'update', 'delete'],
    broadcasts: ['view', 'create', 'update', 'delete'],
    grants: ['view'],
    jobs: ['view', 'create', 'update', 'delete'],
    assistant_ap: ['view', 'create', 'update'],
    dashboard: ['view'],
    reports: ['view'],
    settings: ['view'],
    public_dashboard: NO_ACTIONS,
    events: ['view', 'create', 'update'],
    asset_access: ['view', 'manage'],
  },
  case_manager: {
    households: ['view', 'create', 'update', 'delete'],
    intake: ['view', 'create', 'update', 'delete'],
    programs: ['view', 'create', 'update', 'delete'],
    contributions: ['view', 'create', 'update', 'delete'],
    community_assets: ['view', 'create', 'update', 'delete'],
    risk_scores: ['view', 'update'],
    referrals: ['view', 'create', 'update', 'delete'],
    relationships: ['view', 'create', 'update', 'delete'],
    broadcasts: ['view', 'create', 'update', 'delete'],
    grants: ['view'],
    jobs: ['view'],
    assistant_ap: ['view', 'create', 'update'],
    dashboard: ['view'],
    reports: ['view'],
    settings: ['view'],
    public_dashboard: NO_ACTIONS,
    events: ['view', 'create', 'update'],
    asset_access: ['view'],
  },
  contractor: {
    households: NO_ACTIONS,
    intake: NO_ACTIONS,
    programs: NO_ACTIONS,
    contributions: NO_ACTIONS,
    community_assets: NO_ACTIONS,
    risk_scores: NO_ACTIONS,
    referrals: NO_ACTIONS,
    relationships: NO_ACTIONS,
    broadcasts: NO_ACTIONS,
    grants: NO_ACTIONS,
    jobs: ['view', 'update'],
    assistant_ap: NO_ACTIONS,
    dashboard: NO_ACTIONS,
    reports: NO_ACTIONS,
    settings: ['view'],
    public_dashboard: NO_ACTIONS,
    events: NO_ACTIONS,
    asset_access: NO_ACTIONS,
  },
  board_viewer: {
    households: NO_ACTIONS,
    intake: NO_ACTIONS,
    programs: NO_ACTIONS,
    contributions: NO_ACTIONS,
    community_assets: NO_ACTIONS,
    risk_scores: NO_ACTIONS,
    referrals: NO_ACTIONS,
    relationships: NO_ACTIONS,
    broadcasts: NO_ACTIONS,
    grants: ['view'],
    jobs: NO_ACTIONS,
    assistant_ap: NO_ACTIONS,
    dashboard: ['view'],
    reports: ['view'],
    settings: NO_ACTIONS,
    public_dashboard: NO_ACTIONS,
    events: NO_ACTIONS,
    asset_access: NO_ACTIONS,
  },
  member: {
    households: NO_ACTIONS,
    intake: NO_ACTIONS,
    programs: NO_ACTIONS,
    contributions: NO_ACTIONS,
    community_assets: NO_ACTIONS,
    risk_scores: NO_ACTIONS,
    referrals: NO_ACTIONS,
    relationships: NO_ACTIONS,
    broadcasts: NO_ACTIONS,
    grants: ['view', 'create', 'update'],
    jobs: NO_ACTIONS,
    assistant_ap: NO_ACTIONS,
    dashboard: ['view'],
    reports: ['view'],
    settings: ['view'],
    public_dashboard: NO_ACTIONS,
    events: NO_ACTIONS,
    asset_access: NO_ACTIONS,
  },
  viewer: {
    households: NO_ACTIONS,
    intake: NO_ACTIONS,
    programs: NO_ACTIONS,
    contributions: NO_ACTIONS,
    community_assets: NO_ACTIONS,
    risk_scores: NO_ACTIONS,
    referrals: NO_ACTIONS,
    relationships: NO_ACTIONS,
    broadcasts: NO_ACTIONS,
    grants: ['view'],
    jobs: NO_ACTIONS,
    assistant_ap: NO_ACTIONS,
    dashboard: ['view'],
    reports: ['view'],
    settings: ['view'],
    public_dashboard: NO_ACTIONS,
    events: NO_ACTIONS,
    asset_access: NO_ACTIONS,
  },
};

export function checkCommunityPermission(
  role: ProjectRole,
  resource: CommunityResource,
  action: CommunityAction
): boolean {
  const permissions = COMMUNITY_PERMISSION_MATRIX[role]?.[resource];
  return permissions?.includes(action) ?? false;
}

export async function requireCommunityPermission(
  supabase: SupabaseClient<Database>,
  userId: string,
  projectId: string,
  resource: CommunityResource,
  action: CommunityAction
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

  // Check override first — deny always wins, grant allows view access
  const override = await getOverride(supabase, userId, projectId, resource);
  if (override === false) {
    throw new ProjectAccessError(`Access to '${resource}' is restricted`);
  }
  if (override === true && action === 'view') {
    // Grant override: allow view unconditionally; write actions still require role support
    return role;
  }

  // Fall back to role matrix
  if (!checkCommunityPermission(role, resource, action)) {
    throw new ProjectAccessError(`Missing community permission '${resource}:${action}'`);
  }

  return role;
}

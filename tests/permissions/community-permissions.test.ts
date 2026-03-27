import { describe, expect, it } from 'vitest';
import {
  checkCommunityPermission,
  type CommunityAction,
  type CommunityResource,
} from '@/lib/projects/community-permissions';
import type { ProjectRole } from '@/types/user';

const RESOURCES: CommunityResource[] = [
  'households',
  'intake',
  'programs',
  'contributions',
  'community_assets',
  'risk_scores',
  'referrals',
  'relationships',
  'broadcasts',
  'grants',
  'jobs',
  'assistant_ap',
  'dashboard',
  'reports',
  'settings',
  'public_dashboard',
  'events',
];

const ACTIONS: CommunityAction[] = ['view', 'create', 'update', 'delete', 'export_pii', 'manage'];

const expectations: Record<ProjectRole, Partial<Record<CommunityResource, CommunityAction[]>>> = {
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
  },
  staff: {
    households: ['view', 'create', 'update', 'delete'],
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
    public_dashboard: [],
    events: ['view', 'create', 'update'],
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
    public_dashboard: [],
    events: ['view', 'create', 'update'],
  },
  contractor: {
    public_dashboard: [],
    jobs: ['view', 'update'],
    settings: ['view'],
  },
  board_viewer: {
    grants: ['view'],
    dashboard: ['view'],
    reports: ['view'],
    public_dashboard: [],
  },
  member: {
    grants: ['view', 'create', 'update'],
    dashboard: ['view'],
    reports: ['view'],
    settings: ['view'],
  },
  viewer: {
    grants: ['view'],
    dashboard: ['view'],
    reports: ['view'],
    settings: ['view'],
  },
};

describe('Community Permission Matrix', () => {
  for (const role of Object.keys(expectations) as ProjectRole[]) {
    it(`matches the expected capability matrix for ${role}`, () => {
      for (const resource of RESOURCES) {
        for (const action of ACTIONS) {
          const expected = expectations[role][resource]?.includes(action) ?? false;
          expect(checkCommunityPermission(role, resource, action)).toBe(expected);
        }
      }
    });
  }
});

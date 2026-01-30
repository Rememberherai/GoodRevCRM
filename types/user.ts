// User management types

export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';

export type NotificationDigest = 'realtime' | 'daily' | 'weekly' | 'never';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  user_id: string;
  project_id: string;
  role: ProjectRole;
  created_at: string;
}

export interface ProjectMemberWithUser extends ProjectMember {
  user: User;
  last_active_at: string | null;
}

export interface ProjectInvitation {
  id: string;
  project_id: string;
  email: string;
  role: ProjectRole;
  invited_by: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface ProjectInvitationWithInviter extends ProjectInvitation {
  inviter: Pick<User, 'id' | 'full_name' | 'email'>;
}

export interface UserSettings {
  id: string;
  user_id: string;
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  date_format: string;
  time_format: string;
  notifications_email: boolean;
  notifications_push: boolean;
  notifications_digest: NotificationDigest;
  default_project_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  project_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  last_active_at: string;
  created_at: string;
}

// Role permissions
export const rolePermissions: Record<ProjectRole, string[]> = {
  owner: [
    'project:delete',
    'project:settings',
    'members:manage',
    'members:remove',
    'webhooks:manage',
    'data:export',
    'data:import',
    'data:delete',
    'entities:create',
    'entities:update',
    'entities:delete',
    'entities:view',
  ],
  admin: [
    'project:settings',
    'members:manage',
    'webhooks:manage',
    'data:export',
    'data:import',
    'data:delete',
    'entities:create',
    'entities:update',
    'entities:delete',
    'entities:view',
  ],
  member: [
    'data:export',
    'entities:create',
    'entities:update',
    'entities:delete',
    'entities:view',
  ],
  viewer: ['entities:view'],
};

export function hasPermission(role: ProjectRole, permission: string): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

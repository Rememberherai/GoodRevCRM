import type { Database } from './database';
import type { ProjectRole as UserProjectRole } from './user';

// Project settings stored in the settings JSONB column
export interface ProjectSettings {
  customRoles?: string[];
}

export type ProjectType = 'standard' | 'community' | 'grants';
export type AccountingTarget = 'goodrev' | 'quickbooks' | 'none';

export type Project = Database['public']['Tables']['projects']['Row'];
export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

export type ProjectMembership = Database['public']['Tables']['project_memberships']['Row'];
export type ProjectRole = UserProjectRole;

export interface ProjectWithMembership extends Project {
  membership?: ProjectMembership;
}

export interface ProjectMember {
  id: string;
  user_id: string;
  role: ProjectRole;
  joined_at: string;
  user: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

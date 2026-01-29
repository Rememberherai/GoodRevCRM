import type { Database } from './database';

export type Project = Database['public']['Tables']['projects']['Row'];
export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

export type ProjectMembership = Database['public']['Tables']['project_memberships']['Row'];
export type ProjectRole = ProjectMembership['role'];

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

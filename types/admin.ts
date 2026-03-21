// System Admin Panel types

export type SystemAdminAction =
  | 'entered_project'
  | 'exited_project'
  | 'deactivated_user'
  | 'reactivated_user'
  | 'soft_deleted_project'
  | 'restored_project'
  | 'updated_system_setting'
  | 'viewed_project'
  | 'updated_bug_report';

export type AdminTargetType = 'user' | 'project' | 'setting' | 'bug_report';

export interface SystemAdminLog {
  id: string;
  admin_user_id: string;
  action: SystemAdminAction;
  target_type: AdminTargetType;
  target_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface SystemSetting {
  key: string;
  value: unknown;
  updated_by: string | null;
  updated_at: string;
}

export interface AdminSession {
  id: string;
  admin_user_id: string;
  project_id: string;
  membership_id: string;
  entered_at: string;
  exited_at: string | null;
}

export interface AdminStats {
  total_users: number;
  total_projects: number;
  active_projects_7d: number;
  new_users_30d: number;
  projects_by_type: {
    standard: number;
    community: number;
  };
  projects_missing_api_key: number;
  open_bug_reports: number;
  signups_by_week: Array<{ week: string; count: number }>;
  projects_by_week: Array<{ week: string; count: number }>;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_system_admin: boolean;
  created_at: string;
  project_count: number;
  last_active_at: string | null;
  is_banned: boolean;
}

export interface AdminProjectListItem {
  id: string;
  name: string;
  slug: string;
  project_type: 'standard' | 'community';
  owner_email: string;
  owner_name: string | null;
  member_count: number;
  created_at: string;
  last_activity_at: string | null;
  deleted_at: string | null;
  has_api_key: boolean;
}

export interface AdminBugReportListItem {
  id: string;
  description: string;
  page_url: string;
  screenshot_path: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  reporter: { id: string; full_name: string | null; email: string };
  project: { id: string; name: string; slug: string } | null;
  assigned_to: { id: string; full_name: string | null; email: string } | null;
  admin_notes: string | null;
  resolution_notes: string | null;
  user_agent: string | null;
  created_at: string;
  resolved_at: string | null;
}

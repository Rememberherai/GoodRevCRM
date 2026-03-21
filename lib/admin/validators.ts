import { z } from 'zod';

export const adminUserListSchema = z.object({
  search: z.string().optional(),
  filter_role: z.string().optional(),
  filter_admin: z.coerce.boolean().optional(),
  filter_status: z.enum(['active', 'deactivated']).optional(),
  sort_by: z.enum(['name', 'email', 'created_at', 'last_active_at', 'project_count']).optional(),
  sort_dir: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(0).optional().default(0),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});

export const adminProjectListSchema = z.object({
  search: z.string().optional(),
  filter_type: z.enum(['standard', 'community']).optional(),
  filter_status: z.enum(['active', 'deleted']).optional(),
  filter_api_key: z.enum(['configured', 'missing']).optional(),
  sort_by: z.enum(['name', 'created_at', 'last_activity_at', 'member_count']).optional(),
  sort_dir: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(0).optional().default(0),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});

export const adminActivityListSchema = z.object({
  type: z.enum(['all', 'crm', 'admin']).optional().default('all'),
  project_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  action: z.string().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  page: z.coerce.number().int().min(0).optional().default(0),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const adminUserActionSchema = z.object({
  action: z.enum(['deactivate', 'reactivate']),
});

export const adminProjectActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('soft_delete'), confirm_name: z.string() }),
  z.object({ action: z.literal('restore') }),
]);

export const adminBugReportListSchema = z.object({
  search: z.string().optional(),
  filter_status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  filter_priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  filter_assigned_to: z.string().uuid().optional(),
  filter_project_id: z.string().uuid().optional(),
  sort_by: z.enum(['created_at', 'priority', 'status']).optional(),
  sort_dir: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(0).optional().default(0),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});

export const adminBugReportUpdateSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  admin_notes: z.string().optional(),
  resolution_notes: z.string().optional(),
});

export const bugReportSubmitSchema = z.object({
  description: z.string().min(10, 'Please describe the issue in at least 10 characters'),
  page_url: z.string().url(),
  screenshot_path: z.string().optional(),
  user_agent: z.string(),
  project_id: z.string().uuid().nullable().optional(),
});

export const adminSettingUpdateSchema = z.object({
  key: z.string(),
  value: z.unknown(),
});

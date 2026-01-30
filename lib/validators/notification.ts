import { z } from 'zod';

// Notification types
export const notificationTypes = [
  'task_assigned',
  'task_due',
  'task_overdue',
  'task_completed',
  'opportunity_assigned',
  'opportunity_won',
  'opportunity_lost',
  'opportunity_stage_changed',
  'mention',
  'comment',
  'reply',
  'email_received',
  'email_opened',
  'email_replied',
  'meeting_reminder',
  'meeting_scheduled',
  'import_completed',
  'export_ready',
  'team_invite',
  'team_member_joined',
  'system',
  'custom',
] as const;

// Notification priorities
export const notificationPriorities = ['low', 'normal', 'high', 'urgent'] as const;

// Batch types
export const batchTypes = ['daily', 'weekly'] as const;

// Batch statuses
export const batchStatuses = ['pending', 'sending', 'sent', 'failed'] as const;

// Create notification schema (for API/service use)
export const createNotificationSchema = z.object({
  user_id: z.string().uuid(),
  project_id: z.string().uuid().nullable().optional(),
  type: z.enum(notificationTypes),
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(2000),
  data: z.record(z.string(), z.unknown()).optional(),
  entity_type: z.string().max(50).nullable().optional(),
  entity_id: z.string().uuid().nullable().optional(),
  priority: z.enum(notificationPriorities).optional(),
  action_url: z.string().url().nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;

// Notification query schema
export const notificationQuerySchema = z.object({
  type: z.enum(notificationTypes).optional(),
  is_read: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  is_archived: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  priority: z.enum(notificationPriorities).optional(),
  project_id: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type NotificationQueryInput = z.infer<typeof notificationQuerySchema>;

// Mark notifications as read schema
export const markReadSchema = z.object({
  notification_ids: z.array(z.string().uuid()).min(1).max(100),
});

export type MarkReadInput = z.infer<typeof markReadSchema>;

// Mark all as read schema
export const markAllReadSchema = z.object({
  project_id: z.string().uuid().nullable().optional(),
});

export type MarkAllReadInput = z.infer<typeof markAllReadSchema>;

// Archive notifications schema
export const archiveSchema = z.object({
  notification_ids: z.array(z.string().uuid()).min(1).max(100),
});

export type ArchiveInput = z.infer<typeof archiveSchema>;

// Notification preference schema
export const notificationPreferenceSchema = z.object({
  notification_type: z.enum(notificationTypes),
  email_enabled: z.boolean().optional(),
  push_enabled: z.boolean().optional(),
  in_app_enabled: z.boolean().optional(),
});

export type NotificationPreferenceInput = z.infer<typeof notificationPreferenceSchema>;

// Update preferences schema (batch update)
export const updatePreferencesSchema = z.object({
  preferences: z.array(notificationPreferenceSchema).min(1),
  project_id: z.string().uuid().nullable().optional(),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

// Preference query schema
export const preferenceQuerySchema = z.object({
  project_id: z.string().uuid().optional(),
});

export type PreferenceQueryInput = z.infer<typeof preferenceQuerySchema>;

// Push subscription schema
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  user_agent: z.string().max(500).optional(),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

// Unsubscribe schema
export const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export type UnsubscribeInput = z.infer<typeof unsubscribeSchema>;

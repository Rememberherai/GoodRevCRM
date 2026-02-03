// Notification Types

export type NotificationType =
  | 'task_assigned'
  | 'task_due'
  | 'task_overdue'
  | 'task_completed'
  | 'opportunity_assigned'
  | 'opportunity_won'
  | 'opportunity_lost'
  | 'opportunity_stage_changed'
  | 'mention'
  | 'comment'
  | 'reply'
  | 'email_received'
  | 'email_opened'
  | 'email_replied'
  | 'meeting_reminder'
  | 'meeting_scheduled'
  | 'import_completed'
  | 'export_ready'
  | 'enrichment_completed'
  | 'team_invite'
  | 'team_member_joined'
  | 'system'
  | 'custom';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export type BatchType = 'daily' | 'weekly';

export type BatchStatus = 'pending' | 'sending' | 'sent' | 'failed';

// Notification
export interface Notification {
  id: string;
  user_id: string;
  project_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown>;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  read_at: string | null;
  is_archived: boolean;
  archived_at: string | null;
  priority: NotificationPriority;
  action_url: string | null;
  expires_at: string | null;
  created_at: string;
}

// Notification preferences
export interface NotificationPreference {
  id: string;
  user_id: string;
  project_id: string | null;
  notification_type: NotificationType;
  email_enabled: boolean;
  push_enabled: boolean;
  in_app_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// Push subscription
export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Notification batch
export interface NotificationBatch {
  id: string;
  user_id: string;
  batch_type: BatchType;
  notifications: Notification[];
  notification_count: number;
  status: BatchStatus;
  scheduled_for: string;
  sent_at: string | null;
  created_at: string;
}

// Notification type labels
export const notificationTypeLabels: Record<NotificationType, string> = {
  task_assigned: 'Task Assigned',
  task_due: 'Task Due',
  task_overdue: 'Task Overdue',
  task_completed: 'Task Completed',
  opportunity_assigned: 'Opportunity Assigned',
  opportunity_won: 'Opportunity Won',
  opportunity_lost: 'Opportunity Lost',
  opportunity_stage_changed: 'Stage Changed',
  mention: 'Mention',
  comment: 'Comment',
  reply: 'Reply',
  email_received: 'Email Received',
  email_opened: 'Email Opened',
  email_replied: 'Email Replied',
  meeting_reminder: 'Meeting Reminder',
  meeting_scheduled: 'Meeting Scheduled',
  import_completed: 'Import Completed',
  export_ready: 'Export Ready',
  enrichment_completed: 'Enrichment Complete',
  team_invite: 'Team Invitation',
  team_member_joined: 'Team Member Joined',
  system: 'System',
  custom: 'Custom',
};

// Notification type categories for settings
export const notificationCategories: Record<string, NotificationType[]> = {
  Tasks: ['task_assigned', 'task_due', 'task_overdue', 'task_completed'],
  Opportunities: [
    'opportunity_assigned',
    'opportunity_won',
    'opportunity_lost',
    'opportunity_stage_changed',
  ],
  Communication: ['mention', 'comment', 'reply'],
  Email: ['email_received', 'email_opened', 'email_replied'],
  Meetings: ['meeting_reminder', 'meeting_scheduled'],
  'Data Operations': ['import_completed', 'export_ready', 'enrichment_completed'],
  Team: ['team_invite', 'team_member_joined'],
  Other: ['system', 'custom'],
};

// Priority colors
export const priorityColors: Record<NotificationPriority, string> = {
  low: 'bg-gray-100 text-gray-800',
  normal: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

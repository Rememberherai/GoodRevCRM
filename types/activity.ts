// Activity entity types
export type ActivityEntityType =
  | 'person'
  | 'organization'
  | 'opportunity'
  | 'rfp'
  | 'task'
  | 'note'
  | 'sequence'
  | 'email'
  | 'meeting';

// Activity actions
export type ActivityAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'restored'
  | 'assigned'
  | 'unassigned'
  | 'status_changed'
  | 'stage_changed'
  | 'enrolled'
  | 'unenrolled'
  | 'sent'
  | 'opened'
  | 'clicked'
  | 'replied'
  | 'logged'
  | 'completed';

// CRM activity types (for manual logging)
export type ActivityType =
  | 'call'
  | 'email'
  | 'meeting'
  | 'note'
  | 'task'
  | 'sequence_completed'
  | 'system';

// Activity outcomes
export type ActivityOutcome =
  | 'call_no_answer'
  | 'call_left_message'
  | 'quality_conversation'
  | 'meeting_booked'
  | 'email_sent'
  | 'email_opened'
  | 'email_replied'
  | 'proposal_sent'
  | 'follow_up_scheduled'
  | 'not_interested'
  | 'other';

// Activity direction
export type ActivityDirection = 'inbound' | 'outbound';

// Activity change record
export interface ActivityChange {
  field: string;
  old_value: unknown;
  new_value: unknown;
}

// Activity log entry
export interface ActivityLog {
  id: string;
  project_id: string;
  user_id: string;
  entity_type: ActivityEntityType;
  entity_id: string;
  action: ActivityAction;
  changes: Record<string, { old: unknown; new: unknown }>;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  // CRM activity fields
  person_id: string | null;
  organization_id: string | null;
  opportunity_id: string | null;
  rfp_id: string | null;
  activity_type: ActivityType | null;
  outcome: ActivityOutcome | null;
  direction: ActivityDirection | null;
  subject: string | null;
  notes: string | null;
  duration_minutes: number | null;
  follow_up_date: string | null;
  follow_up_task_id: string | null;
}

// Activity with user info and relations
export interface ActivityWithUser extends ActivityLog {
  user?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
  person?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
  } | null;
  organization?: {
    id: string;
    name: string;
  } | null;
  follow_up_task?: {
    id: string;
    title: string;
    status: string;
    due_date: string | null;
  } | null;
}

// Activity summary for timeline display
export interface ActivitySummary {
  id: string;
  entity_type: ActivityEntityType;
  entity_id: string;
  action: ActivityAction;
  description: string;
  user_name: string | null;
  user_avatar: string | null;
  created_at: string;
  metadata?: Record<string, unknown>;
}

// Constants

export const activityTypes: ActivityType[] = [
  'call', 'email', 'meeting', 'note', 'task', 'sequence_completed', 'system',
];

export const activityOutcomes: ActivityOutcome[] = [
  'call_no_answer', 'call_left_message', 'quality_conversation', 'meeting_booked',
  'email_sent', 'email_opened', 'email_replied', 'proposal_sent',
  'follow_up_scheduled', 'not_interested', 'other',
];

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  note: 'Note',
  task: 'Task',
  sequence_completed: 'Sequence Completed',
  system: 'System',
};

export const OUTCOME_LABELS: Record<ActivityOutcome, string> = {
  call_no_answer: 'No Answer',
  call_left_message: 'Left Message',
  quality_conversation: 'Quality Conversation',
  meeting_booked: 'Meeting Booked',
  email_sent: 'Email Sent',
  email_opened: 'Email Opened',
  email_replied: 'Email Replied',
  proposal_sent: 'Proposal Sent',
  follow_up_scheduled: 'Follow-up Scheduled',
  not_interested: 'Not Interested',
  other: 'Other',
};

export const ACTIVITY_TYPE_OUTCOMES: Record<ActivityType, ActivityOutcome[]> = {
  call: ['call_no_answer', 'call_left_message', 'quality_conversation', 'meeting_booked', 'not_interested', 'other'],
  email: ['email_sent', 'email_replied', 'meeting_booked', 'not_interested', 'other'],
  meeting: ['quality_conversation', 'meeting_booked', 'proposal_sent', 'follow_up_scheduled', 'not_interested', 'other'],
  note: ['other'],
  task: ['follow_up_scheduled', 'other'],
  sequence_completed: ['follow_up_scheduled', 'other'],
  system: [],
};

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
  | 'received'
  | 'opened'
  | 'clicked'
  | 'replied'
  | 'logged'
  | 'completed';

// CRM activity types (for manual logging)
export type ActivityType =
  | 'call'
  | 'email'
  | 'sms'
  | 'meeting'
  | 'note'
  | 'task'
  | 'linkedin'
  | 'sequence_completed'
  | 'system';

// Activity outcomes
export type ActivityOutcome =
  | 'call_no_answer'
  | 'call_left_message'
  | 'call_back_later'
  | 'wrong_number'
  | 'do_not_call'
  | 'quality_conversation'
  | 'meeting_booked'
  | 'email_sent'
  | 'email_received'
  | 'email_opened'
  | 'email_replied'
  | 'sms_sent'
  | 'sms_received'
  | 'sms_delivered'
  | 'sms_failed'
  | 'linkedin_connection_sent'
  | 'linkedin_connection_accepted'
  | 'linkedin_inmail_sent'
  | 'linkedin_message_sent'
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
  'call', 'email', 'sms', 'linkedin', 'meeting', 'note', 'task', 'sequence_completed', 'system',
];

export const activityOutcomes: ActivityOutcome[] = [
  'call_no_answer', 'call_left_message', 'call_back_later', 'wrong_number', 'do_not_call',
  'quality_conversation', 'meeting_booked',
  'email_sent', 'email_received', 'email_opened', 'email_replied',
  'sms_sent', 'sms_received', 'sms_delivered', 'sms_failed',
  'linkedin_connection_sent', 'linkedin_connection_accepted', 'linkedin_inmail_sent', 'linkedin_message_sent',
  'proposal_sent', 'follow_up_scheduled', 'not_interested', 'other',
];

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  call: 'Call',
  email: 'Email',
  sms: 'SMS',
  linkedin: 'LinkedIn',
  meeting: 'Meeting',
  note: 'Note',
  task: 'Task',
  sequence_completed: 'Sequence Completed',
  system: 'System',
};

export const OUTCOME_LABELS: Record<ActivityOutcome, string> = {
  call_no_answer: 'No Answer',
  call_left_message: 'Left Message',
  call_back_later: 'Call Back Later',
  wrong_number: 'Wrong Number',
  do_not_call: 'Do Not Call',
  quality_conversation: 'Quality Conversation',
  meeting_booked: 'Meeting Booked',
  email_sent: 'Email Sent',
  email_received: 'Email Received',
  email_opened: 'Email Opened',
  email_replied: 'Email Replied',
  sms_sent: 'SMS Sent',
  sms_received: 'SMS Received',
  sms_delivered: 'SMS Delivered',
  sms_failed: 'SMS Failed',
  linkedin_connection_sent: 'Connection Sent',
  linkedin_connection_accepted: 'Connection Accepted',
  linkedin_inmail_sent: 'InMail Sent',
  linkedin_message_sent: 'Message Sent',
  proposal_sent: 'Proposal Sent',
  follow_up_scheduled: 'Follow-up Scheduled',
  not_interested: 'Not Interested',
  other: 'Other',
};

export const ACTIVITY_TYPE_OUTCOMES: Record<ActivityType, ActivityOutcome[]> = {
  call: ['call_no_answer', 'call_left_message', 'call_back_later', 'wrong_number', 'do_not_call', 'quality_conversation', 'meeting_booked', 'not_interested', 'other'],
  email: ['email_sent', 'email_received', 'email_replied', 'meeting_booked', 'not_interested', 'other'],
  sms: ['sms_sent', 'sms_received', 'sms_delivered', 'sms_failed', 'other'],
  linkedin: ['linkedin_connection_sent', 'linkedin_connection_accepted', 'linkedin_inmail_sent', 'linkedin_message_sent', 'meeting_booked', 'not_interested', 'other'],
  meeting: ['quality_conversation', 'meeting_booked', 'proposal_sent', 'follow_up_scheduled', 'not_interested', 'other'],
  note: ['other'],
  task: ['follow_up_scheduled', 'other'],
  sequence_completed: ['follow_up_scheduled', 'other'],
  system: [],
};

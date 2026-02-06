// Sequence status
export type SequenceStatus = 'draft' | 'active' | 'paused' | 'archived';

// Enrollment status
export type EnrollmentStatus = 'active' | 'paused' | 'completed' | 'bounced' | 'replied' | 'unsubscribed';

// Step type
export type StepType = 'email' | 'delay' | 'condition' | 'sms' | 'call' | 'task' | 'linkedin';

// LinkedIn action type for linkedin steps
export type LinkedInActionType = 'view_profile' | 'send_connection' | 'send_message';

// Priority type for manual action steps
export type StepPriority = 'low' | 'medium' | 'high' | 'urgent';

// Config for call steps (creates a task to call the contact)
export interface CallStepConfig {
  title: string;
  description: string;
  priority: StepPriority;
  due_in_hours: number;
}

// Config for task steps (creates a generic task)
export interface TaskStepConfig {
  title: string;
  description: string;
  priority: StepPriority;
  due_in_hours: number;
}

// Config for linkedin steps (creates a LinkedIn action task)
export interface LinkedInStepConfig {
  action: LinkedInActionType;
  title: string;
  description: string;
  message_template: string;
  priority: StepPriority;
  due_in_hours: number;
}

// Union type for step configs
export type StepConfig = CallStepConfig | TaskStepConfig | LinkedInStepConfig;

// Delay unit
export type DelayUnit = 'minutes' | 'hours' | 'days' | 'weeks';

// Sequence
export interface Sequence {
  id: string;
  project_id: string;
  organization_id: string | null; // If set, sequence is organization-specific
  person_id: string | null; // If set, sequence is person-specific
  name: string;
  description: string | null;
  status: SequenceStatus;
  settings: SequenceSettings;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SequenceSettings {
  send_as_reply: boolean;
  stop_on_reply: boolean;
  stop_on_bounce: boolean;
  track_opens: boolean;
  track_clicks: boolean;
  send_window_start?: string; // HH:MM
  send_window_end?: string;
  send_days?: number[]; // 0-6, Sunday = 0
  timezone?: string;
  follow_up_delay_days?: number; // Days after completion to create follow-up task (default: 3)
}

// Sequence step
export interface SequenceStep {
  id: string;
  sequence_id: string;
  step_number: number;
  step_type: StepType;
  // Email step fields
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  // Delay step fields
  delay_amount: number | null;
  delay_unit: DelayUnit | null;
  // Condition step fields
  condition: StepCondition | null;
  // SMS step fields
  sms_body: string | null;
  // Manual action step config (call, task, linkedin)
  config: StepConfig | null;
  created_at: string;
  updated_at: string;
}

export interface StepCondition {
  type: 'opened' | 'clicked' | 'not_opened' | 'not_clicked';
  step_id?: string;
}

// Sequence enrollment
export interface SequenceEnrollment {
  id: string;
  sequence_id: string;
  person_id: string;
  gmail_connection_id: string;
  current_step: number;
  status: EnrollmentStatus;
  next_send_at: string | null;
  completed_at: string | null;
  reply_detected_at: string | null;
  bounce_detected_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Email signature
export interface EmailSignature {
  id: string;
  user_id: string;
  project_id: string;
  name: string;
  content_html: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// Variable for email personalization
export interface SequenceVariable {
  name: string;
  label: string;
  description: string;
  entity: 'person' | 'organization' | 'user';
  field: string;
}

// Default variables available in sequences
export const SEQUENCE_VARIABLES: SequenceVariable[] = [
  { name: 'first_name', label: 'First Name', description: "Recipient's first name", entity: 'person', field: 'first_name' },
  { name: 'last_name', label: 'Last Name', description: "Recipient's last name", entity: 'person', field: 'last_name' },
  { name: 'full_name', label: 'Full Name', description: "Recipient's full name", entity: 'person', field: 'full_name' },
  { name: 'email', label: 'Email', description: "Recipient's email", entity: 'person', field: 'email' },
  { name: 'job_title', label: 'Job Title', description: "Recipient's job title", entity: 'person', field: 'job_title' },
  { name: 'company_name', label: 'Company Name', description: 'Company name', entity: 'organization', field: 'name' },
  { name: 'company_domain', label: 'Company Domain', description: 'Company domain', entity: 'organization', field: 'domain' },
  { name: 'sender_name', label: 'Sender Name', description: "Sender's name", entity: 'user', field: 'full_name' },
  { name: 'sender_email', label: 'Sender Email', description: "Sender's email", entity: 'user', field: 'email' },
];

// Status labels and colors
export const SEQUENCE_STATUS_LABELS: Record<SequenceStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
};

export const SEQUENCE_STATUS_COLORS: Record<SequenceStatus, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  archived: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  bounced: 'Bounced',
  replied: 'Replied',
  unsubscribed: 'Unsubscribed',
};

export const ENROLLMENT_STATUS_COLORS: Record<EnrollmentStatus, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  bounced: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  replied: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  unsubscribed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

export const DELAY_UNIT_LABELS: Record<DelayUnit, string> = {
  minutes: 'Minutes',
  hours: 'Hours',
  days: 'Days',
  weeks: 'Weeks',
};

// Step type labels and colors for UI
export const STEP_TYPE_LABELS: Record<StepType, string> = {
  email: 'Email',
  delay: 'Wait',
  condition: 'Condition',
  sms: 'SMS',
  call: 'Phone Call',
  task: 'Task',
  linkedin: 'LinkedIn',
};

export const STEP_TYPE_COLORS: Record<StepType, { bg: string; text: string }> = {
  email: { bg: 'bg-blue-100', text: 'text-blue-600' },
  delay: { bg: 'bg-gray-100', text: 'text-gray-600' },
  condition: { bg: 'bg-amber-100', text: 'text-amber-600' },
  sms: { bg: 'bg-purple-100', text: 'text-purple-600' },
  call: { bg: 'bg-green-100', text: 'text-green-600' },
  task: { bg: 'bg-orange-100', text: 'text-orange-600' },
  linkedin: { bg: 'bg-sky-100', text: 'text-sky-600' },
};

export const LINKEDIN_ACTION_LABELS: Record<LinkedInActionType, string> = {
  view_profile: 'View Profile',
  send_connection: 'Send Connection Request',
  send_message: 'Send Message',
};

export const PRIORITY_LABELS: Record<StepPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

// Default configs for manual action steps
export const DEFAULT_CALL_CONFIG: CallStepConfig = {
  title: 'Call {{first_name}} {{last_name}}',
  description: 'Phone: {{phone}}',
  priority: 'high',
  due_in_hours: 24,
};

export const DEFAULT_TASK_CONFIG: TaskStepConfig = {
  title: 'Task for {{first_name}} {{last_name}}',
  description: '',
  priority: 'medium',
  due_in_hours: 48,
};

export const DEFAULT_LINKEDIN_CONFIG: LinkedInStepConfig = {
  action: 'view_profile',
  title: 'LinkedIn: View {{first_name}} {{last_name}}',
  description: 'Profile: {{linkedin}}',
  message_template: '',
  priority: 'medium',
  due_in_hours: 24,
};

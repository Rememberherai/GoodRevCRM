// Automation types

export type TriggerType =
  // Entity events
  | 'entity.created'
  | 'entity.updated'
  | 'entity.deleted'
  | 'entity.merged'
  | 'field.changed'
  // Stage/status changes
  | 'opportunity.stage_changed'
  | 'rfp.status_changed'
  | 'quote.status_changed'
  | 'quote.accepted'
  // Email events
  | 'email.opened'
  | 'email.clicked'
  | 'email.replied'
  | 'email.bounced'
  | 'email.unknown_sender'
  // SMS events
  | 'sms.sent'
  | 'sms.delivered'
  | 'sms.failed'
  | 'sms.received'
  // Sequence events
  | 'sequence.completed'
  | 'sequence.replied'
  // Meeting events
  | 'meeting.scheduled'
  | 'meeting.outcome'
  // Task events
  | 'task.completed'
  // Time-based
  | 'time.entity_inactive'
  | 'time.task_overdue'
  | 'time.close_date_approaching'
  | 'time.created_ago'
  // Call events
  | 'call.completed'
  | 'call.missed'
  | 'call.dispositioned'
  // News events
  | 'news.article_found'
  // Workflow events
  | 'workflow.completed'
  | 'workflow.failed'
  | 'workflow.step_failed'
  // Document/contract events
  | 'document.sent'
  | 'document.signed'
  | 'document.completed'
  | 'document.declined'
  | 'document.expired'
  | 'document.voided'
  // Accounting events
  | 'invoice.created'
  | 'invoice.sent'
  | 'invoice.paid'
  | 'invoice.overdue'
  | 'bill.created'
  | 'bill.received'
  | 'bill.paid'
  | 'bill.overdue'
  | 'payment.received'
  | 'payment.made'
  // Booking events
  | 'booking.created'
  | 'booking.confirmed'
  | 'booking.cancelled'
  | 'booking.rescheduled'
  | 'booking.completed'
  | 'booking.no_show'
  // Event type events
  | 'event_type.created'
  // Community events
  | 'household.created'
  | 'household.member_added'
  | 'program.enrollment.created'
  | 'program.attendance.batch'
  | 'contribution.created'
  | 'job.assigned'
  | 'job.accepted'
  | 'job.declined'
  | 'job.completed'
  | 'contractor.onboarded'
  | 'referral.created'
  | 'referral.completed'
  | 'broadcast.sent'
  | 'grant.created'
  | 'grant.status_changed'
  | 'grant.deadline_approaching'
  | 'risk_score.high';

export type ActionType =
  | 'create_task'
  | 'update_field'
  | 'change_stage'
  | 'change_status'
  | 'assign_owner'
  | 'send_notification'
  | 'send_email'
  | 'send_sms'
  | 'enroll_in_sequence'
  | 'add_tag'
  | 'remove_tag'
  | 'run_ai_research'
  | 'create_activity'
  | 'fire_webhook'
  | 'run_workflow';

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty'
  | 'in'
  | 'not_in';

export type AutomationEntityType =
  | 'organization'
  | 'person'
  | 'household'
  | 'opportunity'
  | 'rfp'
  | 'product'
  | 'quote'
  | 'task'
  | 'meeting'
  | 'call'
  | 'workflow'
  | 'document'
  | 'invoice'
  | 'bill'
  | 'payment'
  | 'booking'
  | 'event_type'
  | 'disposition'
  | 'program'
  | 'program_enrollment'
  | 'program_attendance'
  | 'contribution'
  | 'community_asset'
  | 'referral'
  | 'relationship'
  | 'broadcast'
  | 'intake'
  | 'household_member'
  | 'job'
  | 'contractor_scope'
  | 'receipt_confirmation'
  | 'grant';

export type ExecutionStatus =
  | 'success'
  | 'partial_failure'
  | 'failed'
  | 'skipped';

export interface AutomationCondition {
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

export interface AutomationAction {
  type: ActionType;
  config: Record<string, unknown>;
}

export interface TriggerConfig {
  entity_type?: AutomationEntityType;
  field_name?: string;
  to_value?: string;
  from_value?: string;
  from_stage?: string;
  to_stage?: string;
  from_status?: string;
  to_status?: string;
  sequence_id?: string;
  meeting_type?: string;
  outcome?: string;
  disposition?: string;
  direction?: string;
  days?: number;
  days_before?: number;
  document_status?: string;
  event_type_id?: string;
  booking_status?: string;
  cancelled_by?: string;
}

export interface Automation {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: TriggerType;
  trigger_config: TriggerConfig;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  execution_count: number;
  last_executed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AutomationExecution {
  id: string;
  automation_id: string;
  trigger_event: Record<string, unknown>;
  conditions_met: boolean;
  actions_results: Array<{
    action_type: ActionType;
    success: boolean;
    error?: string;
    result?: Record<string, unknown>;
  }>;
  status: ExecutionStatus;
  error_message: string | null;
  duration_ms: number | null;
  entity_type: string | null;
  entity_id: string | null;
  executed_at: string;
}

export interface AutomationWithStats extends Automation {
  recent_executions?: AutomationExecution[];
}

// Event emitted to the automation engine
export interface AutomationEvent {
  projectId: string;
  triggerType: TriggerType;
  entityType: AutomationEntityType;
  entityId: string;
  data: Record<string, unknown>;
  previousData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// Trigger type groups for UI
export const triggerTypeGroups = {
  entity: {
    label: 'Entity Events',
    triggers: [
      { type: 'entity.created' as TriggerType, label: 'Entity Created', description: 'When a new record is created' },
      { type: 'entity.updated' as TriggerType, label: 'Entity Updated', description: 'When a record is updated' },
      { type: 'entity.deleted' as TriggerType, label: 'Entity Deleted', description: 'When a record is deleted' },
      { type: 'entity.merged' as TriggerType, label: 'Entity Merged', description: 'When duplicate records are merged' },
      { type: 'field.changed' as TriggerType, label: 'Field Changed', description: 'When a specific field changes value' },
    ],
  },
  pipeline: {
    label: 'Pipeline Events',
    triggers: [
      { type: 'opportunity.stage_changed' as TriggerType, label: 'Opportunity Stage Changed', description: 'When an opportunity moves to a different stage' },
      { type: 'rfp.status_changed' as TriggerType, label: 'RFP Status Changed', description: 'When an RFP status changes' },
      { type: 'quote.status_changed' as TriggerType, label: 'Quote Status Changed', description: 'When a quote status changes' },
      { type: 'quote.accepted' as TriggerType, label: 'Quote Accepted', description: 'When a quote is accepted' },
    ],
  },
  email: {
    label: 'Email Events',
    triggers: [
      { type: 'email.opened' as TriggerType, label: 'Email Opened', description: 'When a tracked email is opened' },
      { type: 'email.clicked' as TriggerType, label: 'Link Clicked', description: 'When a tracked link is clicked' },
      { type: 'email.replied' as TriggerType, label: 'Email Replied', description: 'When a reply is detected' },
      { type: 'email.bounced' as TriggerType, label: 'Email Bounced', description: 'When an email bounces' },
    ],
  },
  sequence: {
    label: 'Sequence Events',
    triggers: [
      { type: 'sequence.completed' as TriggerType, label: 'Sequence Completed', description: 'When a person completes a sequence' },
      { type: 'sequence.replied' as TriggerType, label: 'Sequence Reply', description: 'When a person replies during a sequence' },
    ],
  },
  meeting: {
    label: 'Meeting Events',
    triggers: [
      { type: 'meeting.scheduled' as TriggerType, label: 'Meeting Scheduled', description: 'When a meeting is created' },
      { type: 'meeting.outcome' as TriggerType, label: 'Meeting Outcome', description: 'When a meeting outcome is recorded' },
    ],
  },
  task: {
    label: 'Task Events',
    triggers: [
      { type: 'task.completed' as TriggerType, label: 'Task Completed', description: 'When a task is marked complete' },
    ],
  },
  time: {
    label: 'Time-Based',
    triggers: [
      { type: 'time.entity_inactive' as TriggerType, label: 'Entity Inactive', description: 'When a record hasn\'t been updated in X days' },
      { type: 'time.task_overdue' as TriggerType, label: 'Task Overdue', description: 'When a task is past its due date' },
      { type: 'time.close_date_approaching' as TriggerType, label: 'Close Date Approaching', description: 'When opportunity close date is within X days' },
      { type: 'time.created_ago' as TriggerType, label: 'Created X Days Ago', description: 'When a record was created X days ago' },
    ],
  },
  call: {
    label: 'Call Events',
    triggers: [
      { type: 'call.completed' as TriggerType, label: 'Call Completed', description: 'When an outbound or inbound call is completed' },
      { type: 'call.missed' as TriggerType, label: 'Call Missed', description: 'When a call is missed, busy, or fails' },
      { type: 'call.dispositioned' as TriggerType, label: 'Call Dispositioned', description: 'When a call disposition is recorded' },
    ],
  },
  sms: {
    label: 'SMS Events',
    triggers: [
      { type: 'sms.sent' as TriggerType, label: 'SMS Sent', description: 'When an SMS message is sent' },
      { type: 'sms.delivered' as TriggerType, label: 'SMS Delivered', description: 'When an SMS is confirmed delivered' },
      { type: 'sms.failed' as TriggerType, label: 'SMS Failed', description: 'When an SMS fails to send or deliver' },
      { type: 'sms.received' as TriggerType, label: 'SMS Received', description: 'When an inbound SMS is received' },
    ],
  },
  news: {
    label: 'News Events',
    triggers: [
      { type: 'news.article_found' as TriggerType, label: 'Relevant News Found', description: 'When a news article matching tracked keywords is found' },
    ],
  },
  document: {
    label: 'Document Events',
    triggers: [
      { type: 'document.sent' as TriggerType, label: 'Document Sent', description: 'When a document is sent for signing' },
      { type: 'document.signed' as TriggerType, label: 'Document Signed', description: 'When a signer completes signing' },
      { type: 'document.completed' as TriggerType, label: 'Document Completed', description: 'When all signers have signed' },
      { type: 'document.declined' as TriggerType, label: 'Document Declined', description: 'When a signer declines to sign' },
      { type: 'document.expired' as TriggerType, label: 'Document Expired', description: 'When a document expires' },
      { type: 'document.voided' as TriggerType, label: 'Document Voided', description: 'When a document is voided by the owner' },
    ],
  },
  accounting: {
    label: 'Accounting Events',
    triggers: [
      { type: 'invoice.created' as TriggerType, label: 'Invoice Created', description: 'When a new invoice is created' },
      { type: 'invoice.sent' as TriggerType, label: 'Invoice Sent', description: 'When an invoice is finalized and sent' },
      { type: 'invoice.paid' as TriggerType, label: 'Invoice Paid', description: 'When an invoice is fully paid' },
      { type: 'invoice.overdue' as TriggerType, label: 'Invoice Overdue', description: 'When an invoice passes its due date' },
      { type: 'bill.created' as TriggerType, label: 'Bill Created', description: 'When a new bill is created' },
      { type: 'bill.received' as TriggerType, label: 'Bill Received', description: 'When a bill is marked received' },
      { type: 'bill.paid' as TriggerType, label: 'Bill Paid', description: 'When a bill is fully paid' },
      { type: 'bill.overdue' as TriggerType, label: 'Bill Overdue', description: 'When a bill passes its due date' },
      { type: 'payment.received' as TriggerType, label: 'Payment Received', description: 'When a customer payment is recorded' },
      { type: 'payment.made' as TriggerType, label: 'Payment Made', description: 'When a vendor payment is recorded' },
    ],
  },
  booking: {
    label: 'Booking Events',
    triggers: [
      { type: 'event_type.created' as TriggerType, label: 'Event Type Created', description: 'When a new event type is created' },
      { type: 'booking.created' as TriggerType, label: 'Booking Created', description: 'When a new booking is created via the public booking page' },
      { type: 'booking.confirmed' as TriggerType, label: 'Booking Confirmed', description: 'When a pending booking is confirmed by the host' },
      { type: 'booking.cancelled' as TriggerType, label: 'Booking Cancelled', description: 'When a booking is cancelled by host or invitee' },
      { type: 'booking.rescheduled' as TriggerType, label: 'Booking Rescheduled', description: 'When a booking is rescheduled to a new time' },
      { type: 'booking.completed' as TriggerType, label: 'Booking Completed', description: 'When a booking is marked as completed' },
      { type: 'booking.no_show' as TriggerType, label: 'Booking No-Show', description: 'When an invitee is marked as a no-show' },
    ],
  },
  community: {
    label: 'Community Events',
    triggers: [
      { type: 'household.created' as TriggerType, label: 'Household Created', description: 'When a new household is created' },
      { type: 'household.member_added' as TriggerType, label: 'Household Member Added', description: 'When a person is added to a household' },
      { type: 'program.enrollment.created' as TriggerType, label: 'Program Enrollment Created', description: 'When a program enrollment is created' },
      { type: 'program.attendance.batch' as TriggerType, label: 'Program Attendance Batch', description: 'When a batch attendance save is recorded' },
      { type: 'contribution.created' as TriggerType, label: 'Contribution Created', description: 'When a community contribution is created' },
      { type: 'job.assigned' as TriggerType, label: 'Job Assigned', description: 'When a contractor job is assigned' },
      { type: 'job.accepted' as TriggerType, label: 'Job Accepted', description: 'When a contractor accepts a job' },
      { type: 'job.declined' as TriggerType, label: 'Job Declined', description: 'When a contractor declines a job' },
      { type: 'job.completed' as TriggerType, label: 'Job Completed', description: 'When a contractor completes a job' },
      { type: 'contractor.onboarded' as TriggerType, label: 'Contractor Onboarded', description: 'When a contractor onboarding flow completes' },
      { type: 'referral.created' as TriggerType, label: 'Referral Created', description: 'When a referral is created' },
      { type: 'referral.completed' as TriggerType, label: 'Referral Completed', description: 'When a referral is completed' },
      { type: 'broadcast.sent' as TriggerType, label: 'Broadcast Sent', description: 'When a broadcast send is completed' },
      { type: 'grant.created' as TriggerType, label: 'Grant Created', description: 'When a new grant record is created' },
      { type: 'grant.status_changed' as TriggerType, label: 'Grant Status Changed', description: 'When a grant moves to a different pipeline stage' },
      { type: 'grant.deadline_approaching' as TriggerType, label: 'Grant Deadline Approaching', description: 'When a grant deadline is within configured days' },
      { type: 'risk_score.high' as TriggerType, label: 'High Risk Score', description: 'When a household is flagged as high risk during recomputation' },
    ],
  },
};

export const allTriggerTypes = Object.values(triggerTypeGroups).flatMap(g => g.triggers.map(t => t.type));

// Time-based trigger types for cron processing
export const timeTriggerTypes: TriggerType[] = [
  'time.entity_inactive',
  'time.task_overdue',
  'time.close_date_approaching',
  'time.created_ago',
];

// Action type metadata for UI
export const actionTypeOptions = [
  { type: 'create_task' as ActionType, label: 'Create Task', description: 'Create a new task linked to the entity' },
  { type: 'update_field' as ActionType, label: 'Update Field', description: 'Update a field on the entity' },
  { type: 'change_stage' as ActionType, label: 'Change Stage', description: 'Move opportunity to a different stage' },
  { type: 'change_status' as ActionType, label: 'Change Status', description: 'Change RFP status' },
  { type: 'assign_owner' as ActionType, label: 'Assign Owner', description: 'Change the entity owner' },
  { type: 'send_notification' as ActionType, label: 'Send Notification', description: 'Send an in-app notification' },
  { type: 'send_email' as ActionType, label: 'Send Email', description: 'Send an email from a template' },
  { type: 'send_sms' as ActionType, label: 'Send SMS', description: 'Send an SMS message to a person' },
  { type: 'enroll_in_sequence' as ActionType, label: 'Enroll in Sequence', description: 'Enroll a person in an email sequence' },
  { type: 'add_tag' as ActionType, label: 'Add Tag', description: 'Add a tag to the entity' },
  { type: 'remove_tag' as ActionType, label: 'Remove Tag', description: 'Remove a tag from the entity' },
  { type: 'run_ai_research' as ActionType, label: 'Run AI Research', description: 'Trigger AI research on the entity' },
  { type: 'create_activity' as ActionType, label: 'Log Activity', description: 'Create a custom activity log entry' },
  { type: 'fire_webhook' as ActionType, label: 'Fire Webhook', description: 'Send a custom webhook request' },
];

export const conditionOperatorLabels: Record<ConditionOperator, string> = {
  equals: 'equals',
  not_equals: 'does not equal',
  contains: 'contains',
  not_contains: 'does not contain',
  greater_than: 'is greater than',
  less_than: 'is less than',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
  in: 'is one of',
  not_in: 'is not one of',
};

export const opportunityStages = [
  'prospecting',
  'qualification',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
] as const;

export const rfpStatuses = [
  'identified',
  'reviewing',
  'preparing',
  'submitted',
  'won',
  'lost',
  'no_bid',
] as const;

import { z } from 'zod';

export const triggerTypes = [
  'entity.created',
  'entity.updated',
  'entity.deleted',
  'field.changed',
  'opportunity.stage_changed',
  'rfp.status_changed',
  'email.opened',
  'email.clicked',
  'email.replied',
  'email.bounced',
  'sequence.completed',
  'sequence.replied',
  'meeting.scheduled',
  'meeting.outcome',
  'task.completed',
  'time.entity_inactive',
  'time.task_overdue',
  'time.close_date_approaching',
  'time.created_ago',
] as const;

export const actionTypes = [
  'create_task',
  'update_field',
  'change_stage',
  'change_status',
  'assign_owner',
  'send_notification',
  'send_email',
  'enroll_in_sequence',
  'add_tag',
  'remove_tag',
  'run_ai_research',
  'create_activity',
  'fire_webhook',
] as const;

export const conditionOperators = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'greater_than',
  'less_than',
  'is_empty',
  'is_not_empty',
  'in',
  'not_in',
] as const;

export const automationEntityTypes = [
  'organization',
  'person',
  'opportunity',
  'rfp',
  'task',
  'meeting',
] as const;

const conditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(conditionOperators),
  value: z.unknown().optional(),
});

const actionSchema = z.object({
  type: z.enum(actionTypes),
  config: z.record(z.string(), z.unknown()).default({}),
});

const triggerConfigSchema = z.object({
  entity_type: z.enum(automationEntityTypes).optional(),
  field_name: z.string().optional(),
  to_value: z.string().optional(),
  from_value: z.string().optional(),
  from_stage: z.string().optional(),
  to_stage: z.string().optional(),
  from_status: z.string().optional(),
  to_status: z.string().optional(),
  sequence_id: z.string().uuid().optional(),
  meeting_type: z.string().optional(),
  outcome: z.string().optional(),
  days: z.number().min(1).max(365).optional(),
  days_before: z.number().min(1).max(365).optional(),
}).passthrough();

// Create automation schema
export const createAutomationSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
  is_active: z.boolean().optional().default(false),
  trigger_type: z.enum(triggerTypes),
  trigger_config: triggerConfigSchema.default({}),
  conditions: z.array(conditionSchema).default([]),
  actions: z.array(actionSchema).min(1, 'At least one action is required'),
});

export type CreateAutomationInput = z.infer<typeof createAutomationSchema>;

// Update automation schema
export const updateAutomationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  is_active: z.boolean().optional(),
  trigger_type: z.enum(triggerTypes).optional(),
  trigger_config: triggerConfigSchema.optional(),
  conditions: z.array(conditionSchema).optional(),
  actions: z.array(actionSchema).min(1).optional(),
});

export type UpdateAutomationInput = z.infer<typeof updateAutomationSchema>;

// Query schema
export const automationQuerySchema = z.object({
  is_active: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type AutomationQueryInput = z.infer<typeof automationQuerySchema>;

// Execution query schema
export const automationExecutionQuerySchema = z.object({
  status: z.enum(['success', 'partial_failure', 'failed', 'skipped']).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type AutomationExecutionQueryInput = z.infer<typeof automationExecutionQuerySchema>;

// Test automation schema
export const testAutomationSchema = z.object({
  entity_type: z.enum(automationEntityTypes),
  entity_id: z.string().uuid(),
});

export type TestAutomationInput = z.infer<typeof testAutomationSchema>;

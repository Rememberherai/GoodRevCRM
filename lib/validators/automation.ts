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

const conditionValueSchema = z.union([
  z.string().max(1000),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.string().max(1000)).max(50),
]);

const conditionSchema = z.object({
  field: z.string().min(1).max(200),
  operator: z.enum(conditionOperators),
  value: conditionValueSchema.optional(),
});

const actionConfigSchema = z.record(z.string().max(100), z.unknown()).default({});

const actionSchema = z.object({
  type: z.enum(actionTypes),
  config: actionConfigSchema,
}).superRefine((data, ctx) => {
  const { type, config } = data;
  const addConfigIssue = (field: string, message: string) => {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['config', field], message });
  };

  if (type === 'fire_webhook') {
    if (config.url !== undefined) {
      const urlStr = String(config.url);
      try {
        const parsed = new URL(urlStr);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          addConfigIssue('url', 'URL must use http or https protocol');
        }
      } catch {
        addConfigIssue('url', 'Invalid URL');
      }
    }
  }

  if (type === 'update_field') {
    if (config.field_name !== undefined && typeof config.field_name !== 'string') {
      addConfigIssue('field_name', 'field_name must be a string');
    }
  }

  if (type === 'assign_owner') {
    if (config.user_id !== undefined) {
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (typeof config.user_id !== 'string' || !uuidRe.test(config.user_id)) {
        addConfigIssue('user_id', 'user_id must be a valid UUID');
      }
    }
  }

  if (type === 'send_email') {
    if (config.template_id !== undefined) {
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (typeof config.template_id !== 'string' || !uuidRe.test(config.template_id)) {
        addConfigIssue('template_id', 'template_id must be a valid UUID');
      }
    }
  }

  if (type === 'enroll_in_sequence') {
    if (config.sequence_id !== undefined) {
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (typeof config.sequence_id !== 'string' || !uuidRe.test(config.sequence_id)) {
        addConfigIssue('sequence_id', 'sequence_id must be a valid UUID');
      }
    }
  }
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
  disposition: z.string().optional(),
  direction: z.string().optional(),
  days: z.number().min(1).max(365).optional(),
  days_before: z.number().min(1).max(365).optional(),
});

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

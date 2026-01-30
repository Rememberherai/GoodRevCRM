import { z } from 'zod';

// Sequence settings schema
const sequenceSettingsSchema = z.object({
  send_as_reply: z.boolean().default(true),
  stop_on_reply: z.boolean().default(true),
  stop_on_bounce: z.boolean().default(true),
  track_opens: z.boolean().default(true),
  track_clicks: z.boolean().default(true),
  send_window_start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  send_window_end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  send_days: z.array(z.number().min(0).max(6)).optional(),
  timezone: z.string().optional(),
});

// Create sequence schema
export const createSequenceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).optional(),
  settings: sequenceSettingsSchema.optional(),
});

export type CreateSequenceInput = z.infer<typeof createSequenceSchema>;

// Update sequence schema
export const updateSequenceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
  settings: sequenceSettingsSchema.optional(),
});

export type UpdateSequenceInput = z.infer<typeof updateSequenceSchema>;

// Step condition schema
const stepConditionSchema = z.object({
  type: z.enum(['opened', 'clicked', 'not_opened', 'not_clicked']),
  step_id: z.string().uuid().optional(),
});

// Create step schema
export const createStepSchema = z.object({
  step_type: z.enum(['email', 'delay', 'condition']),
  step_number: z.number().int().min(1).optional(),
  subject: z.string().max(998).nullable().optional(),
  body_html: z.string().nullable().optional(),
  body_text: z.string().nullable().optional(),
  delay_amount: z.number().int().min(1).nullable().optional(),
  delay_unit: z.enum(['minutes', 'hours', 'days', 'weeks']).nullable().optional(),
  condition: stepConditionSchema.nullable().optional(),
});

export type CreateStepInput = z.infer<typeof createStepSchema>;

// Update step schema
export const updateStepSchema = z.object({
  step_number: z.number().int().min(1).optional(),
  subject: z.string().max(998).nullable().optional(),
  body_html: z.string().nullable().optional(),
  body_text: z.string().nullable().optional(),
  delay_amount: z.number().int().min(1).nullable().optional(),
  delay_unit: z.enum(['minutes', 'hours', 'days', 'weeks']).nullable().optional(),
  condition: stepConditionSchema.nullable().optional(),
});

export type UpdateStepInput = z.infer<typeof updateStepSchema>;

// Enroll person schema
export const enrollPersonSchema = z.object({
  person_id: z.string().uuid('Invalid person ID'),
  gmail_connection_id: z.string().uuid('Invalid Gmail connection ID'),
  start_at: z.string().datetime().optional(),
});

export type EnrollPersonInput = z.infer<typeof enrollPersonSchema>;

// Bulk enroll schema
export const bulkEnrollSchema = z.object({
  person_ids: z.array(z.string().uuid()).min(1).max(100),
  gmail_connection_id: z.string().uuid('Invalid Gmail connection ID'),
  start_at: z.string().datetime().optional(),
});

export type BulkEnrollInput = z.infer<typeof bulkEnrollSchema>;

// Update enrollment schema
export const updateEnrollmentSchema = z.object({
  status: z.enum(['active', 'paused', 'completed', 'bounced', 'replied', 'unsubscribed']).optional(),
  current_step: z.number().int().min(1).optional(),
  next_send_at: z.string().datetime().nullable().optional(),
});

export type UpdateEnrollmentInput = z.infer<typeof updateEnrollmentSchema>;

// Signature schemas
export const createSignatureSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  content_html: z.string().min(1, 'Content is required'),
  is_default: z.boolean().default(false),
});

export type CreateSignatureInput = z.infer<typeof createSignatureSchema>;

export const updateSignatureSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  content_html: z.string().min(1).optional(),
  is_default: z.boolean().optional(),
});

export type UpdateSignatureInput = z.infer<typeof updateSignatureSchema>;

// Query schemas
export const sequenceQuerySchema = z.object({
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type SequenceQuery = z.infer<typeof sequenceQuerySchema>;

export const enrollmentQuerySchema = z.object({
  sequence_id: z.string().uuid().optional(),
  person_id: z.string().uuid().optional(),
  status: z.enum(['active', 'paused', 'completed', 'bounced', 'replied', 'unsubscribed']).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type EnrollmentQuery = z.infer<typeof enrollmentQuerySchema>;

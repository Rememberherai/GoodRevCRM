import { z } from 'zod';

export const caseStatusSchema = z.enum(['open', 'active', 'on_hold', 'closed']);
export const casePrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export const caseGoalStatusSchema = z.enum(['planned', 'in_progress', 'completed', 'cancelled']);

export const createCaseSchema = z.object({
  household_id: z.string().uuid(),
  assigned_to: z.string().uuid().nullable().optional(),
  priority: casePrioritySchema.default('medium'),
  summary: z.string().max(5000).nullable().optional(),
  barriers: z.string().max(5000).nullable().optional(),
  strengths: z.string().max(5000).nullable().optional(),
  consent_notes: z.string().max(5000).nullable().optional(),
  next_follow_up_at: z.string().datetime().nullable().optional(),
});

export const updateCaseSchema = z.object({
  assigned_to: z.string().uuid().nullable().optional(),
  status: caseStatusSchema.optional(),
  priority: casePrioritySchema.optional(),
  closed_reason: z.string().max(2000).nullable().optional(),
  last_contact_at: z.string().datetime().nullable().optional(),
  next_follow_up_at: z.string().datetime().nullable().optional(),
  summary: z.string().max(5000).nullable().optional(),
  barriers: z.string().max(5000).nullable().optional(),
  strengths: z.string().max(5000).nullable().optional(),
  consent_notes: z.string().max(5000).nullable().optional(),
});

export const createCaseGoalSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).nullable().optional(),
  status: caseGoalStatusSchema.default('planned'),
  target_date: z.string().date().nullable().optional(),
  owner_user_id: z.string().uuid().nullable().optional(),
  dimension_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().min(0).default(0),
});

export const updateCaseGoalSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: caseGoalStatusSchema.optional(),
  target_date: z.string().date().nullable().optional(),
  completed_at: z.string().datetime().nullable().optional(),
  owner_user_id: z.string().uuid().nullable().optional(),
  dimension_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
});

export const caseListQuerySchema = z.object({
  status: caseStatusSchema.optional(),
  priority: casePrioritySchema.optional(),
  assigned_to: z.string().uuid().optional(),
  overdue: z.coerce.boolean().optional(),
  household_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const caseTimelineQuerySchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  types: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value.split(',').map((item) => item.trim()).filter(Boolean)
        : ['intake', 'referral', 'note', 'task', 'case_event', 'incident']
    ),
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
export type CreateCaseGoalInput = z.infer<typeof createCaseGoalSchema>;
export type UpdateCaseGoalInput = z.infer<typeof updateCaseGoalSchema>;

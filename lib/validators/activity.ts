import { z } from 'zod';

// Activity entity types
export const activityEntityTypes = [
  'person',
  'organization',
  'opportunity',
  'rfp',
  'task',
  'note',
  'sequence',
  'email',
  'meeting',
] as const;

// Activity actions
export const activityActions = [
  'created',
  'updated',
  'deleted',
  'restored',
  'assigned',
  'unassigned',
  'status_changed',
  'stage_changed',
  'enrolled',
  'unenrolled',
  'sent',
  'opened',
  'clicked',
  'replied',
  'logged',
  'completed',
] as const;

// Activity types (for CRM manual logging)
export const activityTypeValues = [
  'call', 'email', 'meeting', 'note', 'task', 'sequence_completed', 'system',
] as const;

// Activity outcomes
export const activityOutcomeValues = [
  'call_no_answer', 'call_left_message', 'quality_conversation', 'meeting_booked',
  'email_sent', 'email_opened', 'email_replied', 'proposal_sent',
  'follow_up_scheduled', 'not_interested', 'other',
] as const;

// Activity query schema
export const activityQuerySchema = z.object({
  entity_type: z.enum(activityEntityTypes).optional(),
  entity_id: z.string().uuid().optional(),
  action: z.enum(activityActions).optional(),
  user_id: z.string().uuid().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  person_id: z.string().uuid().optional(),
  organization_id: z.string().uuid().optional(),
  opportunity_id: z.string().uuid().optional(),
  rfp_id: z.string().uuid().optional(),
  activity_type: z.enum(activityTypeValues).optional(),
  has_follow_up: z.coerce.boolean().optional(),
  follow_up_before: z.string().datetime().optional(),
  follow_up_after: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type ActivityQuery = z.infer<typeof activityQuerySchema>;

// Create activity schema (for system audit entries)
export const createActivitySchema = z.object({
  entity_type: z.enum(activityEntityTypes),
  entity_id: z.string().uuid(),
  action: z.enum(activityActions),
  changes: z.record(z.string().max(100), z.object({
    old: z.unknown(),
    new: z.unknown(),
  })).refine(obj => Object.keys(obj).length <= 50, { message: 'Too many change entries (max 50)' }).optional().default({}),
  metadata: z.record(z.string().max(100), z.unknown()).refine(obj => Object.keys(obj).length <= 50, { message: 'Too many metadata entries (max 50)' }).optional().default({}),
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>;

// Log activity schema (for manual CRM activity entries)
export const logActivitySchema = z.object({
  activity_type: z.enum(['call', 'email', 'meeting', 'note', 'task'] as const),
  person_id: z.string().uuid('Person is required'),
  organization_id: z.string().uuid().nullable().optional(),
  opportunity_id: z.string().uuid().nullable().optional(),
  rfp_id: z.string().uuid().nullable().optional(),
  subject: z.string().min(1, 'Subject is required').max(500),
  notes: z.string().max(10000).nullable().optional(),
  outcome: z.enum(activityOutcomeValues).nullable().optional(),
  direction: z.enum(['inbound', 'outbound'] as const).nullable().optional(),
  duration_minutes: z.number().int().min(0).max(1440).nullable().optional(),
  follow_up_date: z.string().datetime().nullable().optional(),
  follow_up_title: z.string().max(500).nullable().optional(),
});

export type LogActivityInput = z.infer<typeof logActivitySchema>;

// Follow-up query schema
export const followUpQuerySchema = z.object({
  status: z.enum(['overdue', 'today', 'upcoming', 'all']).optional().default('all'),
  assigned_to: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type FollowUpQuery = z.infer<typeof followUpQuerySchema>;

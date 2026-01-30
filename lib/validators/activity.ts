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
] as const;

// Activity query schema
export const activityQuerySchema = z.object({
  entity_type: z.enum(activityEntityTypes).optional(),
  entity_id: z.string().uuid().optional(),
  action: z.enum(activityActions).optional(),
  user_id: z.string().uuid().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type ActivityQuery = z.infer<typeof activityQuerySchema>;

// Create activity schema (for internal use)
export const createActivitySchema = z.object({
  entity_type: z.enum(activityEntityTypes),
  entity_id: z.string().uuid(),
  action: z.enum(activityActions),
  changes: z.record(z.string(), z.object({
    old: z.unknown(),
    new: z.unknown(),
  })).optional().default({}),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>;

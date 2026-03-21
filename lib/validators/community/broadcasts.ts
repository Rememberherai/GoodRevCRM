import { z } from 'zod';
import { jsonObjectSchema, nullableString, optionalUuidSchema } from './shared';

export const broadcastChannelSchema = z.enum(['email', 'sms', 'both']);
export const broadcastStatusSchema = z.enum(['draft', 'scheduled', 'sending', 'sent', 'failed']);

export const broadcastSchema = z.object({
  project_id: optionalUuidSchema,
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject must be 200 characters or less'),
  body: z.string().min(1, 'Body is required').max(10000, 'Body must be 10000 characters or less'),
  body_html: z.string().max(50000, 'HTML body must be 50000 characters or less').nullable().optional(),
  channel: broadcastChannelSchema,
  filter_criteria: jsonObjectSchema.default({}),
  status: broadcastStatusSchema.default('draft'),
  scheduled_at: z.string().nullable().optional(),
  sent_at: z.string().nullable().optional(),
  failure_reason: nullableString(2000, 'Failure reason must be 2000 characters or less'),
});

export const createBroadcastSchema = broadcastSchema;
export const updateBroadcastSchema = broadcastSchema.partial();

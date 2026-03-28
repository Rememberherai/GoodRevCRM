import { z } from 'zod';
import { jsonObjectSchema, nullableString, optionalUuidSchema } from './shared';

export const broadcastChannelSchema = z.enum(['email', 'sms', 'both']);
export const broadcastStatusSchema = z.enum(['draft', 'scheduled', 'sending', 'sent', 'failed']);

// Base object shape (without refinements) — used to derive both create and update schemas
const broadcastBaseShape = {
  project_id: optionalUuidSchema,
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject must be 200 characters or less'),
  /** Required unless design_json is provided (server derives body and body_html from design). */
  body: z.string().max(10000, 'Body must be 10000 characters or less').optional(),
  body_html: z.string().max(50000, 'HTML body must be 50000 characters or less').nullable().optional(),
  /** Block-based email builder design data (JSON). When present, body_html and body are derived server-side. */
  design_json: z.record(z.string(), z.unknown()).nullable().optional(),
  channel: broadcastChannelSchema,
  filter_criteria: jsonObjectSchema.default({}),
  status: broadcastStatusSchema.default('draft'),
  scheduled_at: z.string().nullable().optional(),
  sent_at: z.string().nullable().optional(),
  failure_reason: nullableString(2000, 'Failure reason must be 2000 characters or less'),
} as const;

export const broadcastSchema = z.object(broadcastBaseShape).refine(
  (data) => (data.design_json != null) || (data.body && data.body.length > 0),
  { message: 'Either body or design_json is required', path: ['body'] }
);

export const createBroadcastSchema = broadcastSchema;

// .partial() cannot be called on a refined schema, so derive from the base shape.
// Reject updates that explicitly clear both body and design_json (would leave broadcast contentless).
export const updateBroadcastSchema = z.object(broadcastBaseShape).partial().refine(
  (data) => {
    const clearingBody = data.body !== undefined && (!data.body || data.body.length === 0);
    const clearingDesign = data.design_json !== undefined && data.design_json == null;
    // Only reject when both are explicitly being cleared in the same update
    return !(clearingBody && clearingDesign);
  },
  { message: 'Cannot clear both body and design_json', path: ['body'] }
);

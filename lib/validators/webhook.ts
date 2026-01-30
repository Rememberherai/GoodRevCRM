import { z } from 'zod';

// Webhook event types
export const webhookEventTypes = [
  'person.created',
  'person.updated',
  'person.deleted',
  'organization.created',
  'organization.updated',
  'organization.deleted',
  'opportunity.created',
  'opportunity.updated',
  'opportunity.deleted',
  'opportunity.stage_changed',
  'opportunity.won',
  'opportunity.lost',
  'task.created',
  'task.updated',
  'task.deleted',
  'task.completed',
  'rfp.created',
  'rfp.updated',
  'rfp.deleted',
  'rfp.status_changed',
  'email.sent',
  'email.opened',
  'email.clicked',
  'email.replied',
] as const;

export const webhookDeliveryStatuses = [
  'pending',
  'delivered',
  'failed',
  'retrying',
] as const;

// Create webhook schema
export const createWebhookSchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().url(),
  secret: z.string().min(16).max(255).optional(),
  events: z.array(z.enum(webhookEventTypes)).min(1),
  headers: z.record(z.string(), z.string()).optional(),
  is_active: z.boolean().optional(),
  retry_count: z.number().min(0).max(10).optional(),
  timeout_ms: z.number().min(1000).max(60000).optional(),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

// Update webhook schema
export const updateWebhookSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  url: z.string().url().optional(),
  secret: z.string().min(16).max(255).nullable().optional(),
  events: z.array(z.enum(webhookEventTypes)).min(1).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  is_active: z.boolean().optional(),
  retry_count: z.number().min(0).max(10).optional(),
  timeout_ms: z.number().min(1000).max(60000).optional(),
});

export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;

// Webhook query schema
export const webhookQuerySchema = z.object({
  is_active: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type WebhookQueryInput = z.infer<typeof webhookQuerySchema>;

// Webhook delivery query schema
export const webhookDeliveryQuerySchema = z.object({
  status: z.enum(webhookDeliveryStatuses).optional(),
  event_type: z.enum(webhookEventTypes).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type WebhookDeliveryQueryInput = z.infer<typeof webhookDeliveryQuerySchema>;

// Test webhook schema
export const testWebhookSchema = z.object({
  event_type: z.enum(webhookEventTypes),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
});

export type TestWebhookInput = z.infer<typeof testWebhookSchema>;

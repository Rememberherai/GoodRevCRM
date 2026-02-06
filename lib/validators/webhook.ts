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

const BLOCKED_HEADER_KEYS = ['host', 'cookie', 'set-cookie', 'transfer-encoding', 'content-length'];

const webhookUrlSchema = z.string().url().refine((url) => {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const hostname = parsed.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
    if (hostname.startsWith('10.') || hostname.startsWith('192.168.')) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return false;
    if (hostname === '169.254.169.254' || hostname.startsWith('169.254.')) return false;
    if (hostname.endsWith('.internal') || hostname.endsWith('.local')) return false;
    return true;
  } catch { return false; }
}, { message: 'URL must use http(s) and must not point to internal/private hosts' });

const safeHeadersSchema = z.record(z.string(), z.string()).optional().refine((headers) => {
  if (!headers) return true;
  return !Object.keys(headers).some(k => BLOCKED_HEADER_KEYS.includes(k.toLowerCase()));
}, { message: `Headers must not include: ${BLOCKED_HEADER_KEYS.join(', ')}` });

// Create webhook schema
export const createWebhookSchema = z.object({
  name: z.string().min(1).max(255),
  url: webhookUrlSchema,
  secret: z.string().min(16).max(255).optional(),
  events: z.array(z.enum(webhookEventTypes)).min(1),
  headers: safeHeadersSchema,
  is_active: z.boolean().optional(),
  retry_count: z.number().min(0).max(10).optional(),
  timeout_ms: z.number().min(1000).max(60000).optional(),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

// Update webhook schema
export const updateWebhookSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  url: webhookUrlSchema.optional(),
  secret: z.string().min(16).max(255).nullable().optional(),
  events: z.array(z.enum(webhookEventTypes)).min(1).optional(),
  headers: safeHeadersSchema,
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
  payload: z.record(z.string(), z.unknown()).optional().default({}).refine(
    (val) => JSON.stringify(val).length <= 10000,
    { message: 'Payload must be under 10,000 characters when serialized' }
  ),
});

export type TestWebhookInput = z.infer<typeof testWebhookSchema>;

import { z } from 'zod';

// Schema for enriching a single person
export const enrichPersonSchema = z.object({
  person_id: z.string().uuid('Invalid person ID'),
});

export type EnrichPersonInput = z.infer<typeof enrichPersonSchema>;

// Schema for bulk enrichment
export const bulkEnrichSchema = z.object({
  person_ids: z
    .array(z.string().uuid('Invalid person ID'))
    .min(1, 'At least one person is required')
    .max(100, 'Maximum 100 people per batch'),
});

export type BulkEnrichInput = z.infer<typeof bulkEnrichSchema>;

// Allowed field names for enrichment updates
const ENRICHMENT_ALLOWED_FIELDS = [
  'email',
  'phone',
  'linkedin_url',
  'job_title',
  'company',
  'headline',
  'first_name',
  'last_name',
  'full_name',
  'location_city',
  'location_state',
  'location_country',
  'personal_email',
  'work_email',
] as const;

// Schema for applying enrichment results
export const applyEnrichmentSchema = z.object({
  job_id: z.string().uuid('Invalid job ID'),
  field_updates: z.array(
    z.object({
      field_name: z.enum(ENRICHMENT_ALLOWED_FIELDS, {
        message: 'Invalid enrichment field name',
      }),
      value: z.union([z.string().max(10000), z.number(), z.boolean(), z.null()]),
    })
  ).max(50, 'Maximum 50 field updates per request'),
});

export type ApplyEnrichmentInput = z.infer<typeof applyEnrichmentSchema>;

// Schema for enrichment history query
export const enrichmentHistoryQuerySchema = z.object({
  person_id: z.string().uuid().optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed'] as const).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

export type EnrichmentHistoryQuery = z.infer<typeof enrichmentHistoryQuerySchema>;

// Schema for FullEnrich v1 webhook payload (matches v1 API format)
// V1 uses "datas" array with "contact" object containing phones/emails
const v1ContactSchema = z.object({
  most_probable_phone: z.string().nullable().optional(),
  phones: z.array(z.object({
    number: z.string(),
    type: z.string().optional(),
    status: z.string().optional(),
  })).optional(),
  most_probable_email: z.string().nullable().optional(),
  most_probable_email_status: z.string().nullable().optional(),
  emails: z.array(z.object({
    email: z.string(),
    status: z.string().optional(),
    type: z.string().optional(),
  })).optional(),
  most_probable_personal_email: z.string().nullable().optional(),
  most_probable_personal_email_status: z.string().nullable().optional(),
  personal_emails: z.array(z.object({
    email: z.string(),
    status: z.string().optional(),
    type: z.string().optional(),
  })).optional(),
  profile: z.object({
    full_name: z.string().nullable().optional(),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    headline: z.string().nullable().optional(),
    job_title: z.string().nullable().optional(),
    company: z.string().nullable().optional(),
    location: z.object({
      city: z.string().nullable().optional(),
      state: z.string().nullable().optional(),
      country: z.string().nullable().optional(),
    }).nullable().optional(),
    linkedin_url: z.string().nullable().optional(),
  }).nullable().optional(),
}).nullable().optional();

const enrichmentRecordSchema = z.object({
  contact: v1ContactSchema,
  custom: z.record(z.string(), z.unknown()).optional(),
  error: z.string().nullable().optional(),
});

// V1 webhook schema (FullEnrich native format)
const v1WebhookSchema = z.object({
  enrichment_id: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  status: z.enum(['CREATED', 'IN_PROGRESS', 'CANCELED', 'CREDITS_INSUFFICIENT', 'FINISHED', 'RATE_LIMIT', 'UNKNOWN'] as const),
  cost: z.object({
    credits: z.number(),
  }).optional(),
  datas: z.array(enrichmentRecordSchema).optional(),
  error: z.string().optional(),
});

// Simplified webhook result schema for internal/test use
const webhookResultSchema = z.object({
  email: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  job_title: z.string().optional(),
  linkedin_url: z.string().optional(),
  phone: z.string().optional(),
  location: z.object({
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  confidence_score: z.number().optional(),
  error: z.string().optional(),
});

// Simplified webhook schema for internal/test use
const simplifiedWebhookSchema = z.object({
  job_id: z.string(),
  status: z.enum(['completed', 'failed'] as const),
  results: z.array(webhookResultSchema).optional(),
  error: z.string().optional(),
  credits_used: z.number().optional(),
});

// Union of both webhook formats
export const enrichmentWebhookSchema = z.union([v1WebhookSchema, simplifiedWebhookSchema]);

export type EnrichmentWebhookPayload = z.infer<typeof enrichmentWebhookSchema>;
export type EnrichmentRecord = z.infer<typeof enrichmentRecordSchema>;

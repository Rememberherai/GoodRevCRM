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

// Schema for applying enrichment results
export const applyEnrichmentSchema = z.object({
  job_id: z.string().uuid('Invalid job ID'),
  field_updates: z.array(
    z.object({
      field_name: z.string().min(1, 'Field name is required'),
      value: z.unknown(),
    })
  ),
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

// Schema for FullEnrich webhook payload (matches their GET /bulk/:id response)
const contactInfoSchema = z.object({
  email: z.object({
    email: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
  }).nullable().optional(),
  phone: z.object({
    phone: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
  }).nullable().optional(),
  emails: z.array(z.object({
    email: z.string(),
    status: z.string().optional(),
    type: z.string().optional(),
  })).optional(),
  phones: z.array(z.object({
    phone: z.string(),
    status: z.string().optional(),
    type: z.string().optional(),
    region: z.string().optional(),
  })).optional(),
}).nullable().optional();

const profileSchema = z.object({
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
}).nullable().optional();

const enrichmentRecordSchema = z.object({
  input: z.object({
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    domain: z.string().nullable().optional(),
    company_name: z.string().nullable().optional(),
    linkedin_url: z.string().nullable().optional(),
  }).optional(),
  custom: z.record(z.string(), z.unknown()).optional(),
  contact_info: contactInfoSchema,
  profile: profileSchema,
  error: z.string().nullable().optional(),
});

export const enrichmentWebhookSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  status: z.enum(['CREATED', 'IN_PROGRESS', 'CANCELED', 'CREDITS_INSUFFICIENT', 'FINISHED', 'RATE_LIMIT', 'UNKNOWN'] as const),
  cost: z.object({
    credits: z.number(),
  }).optional(),
  data: z.array(enrichmentRecordSchema).optional(),
  error: z.string().optional(),
});

export type EnrichmentWebhookPayload = z.infer<typeof enrichmentWebhookSchema>;
export type EnrichmentRecord = z.infer<typeof enrichmentRecordSchema>;

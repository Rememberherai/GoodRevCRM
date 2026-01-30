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

// Schema for webhook payload
export const enrichmentWebhookSchema = z.object({
  job_id: z.string(),
  status: z.enum(['completed', 'failed'] as const),
  results: z.array(z.object({
    person_id: z.string().optional(),
    email: z.string().nullable().optional(),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    job_title: z.string().nullable().optional(),
    linkedin_url: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    location: z.object({
      city: z.string().nullable(),
      state: z.string().nullable(),
      country: z.string().nullable(),
    }).nullable().optional(),
    confidence_score: z.number().nullable().optional(),
    error: z.string().nullable().optional(),
  })).optional(),
  error: z.string().optional(),
  credits_used: z.number().optional(),
});

export type EnrichmentWebhookPayload = z.infer<typeof enrichmentWebhookSchema>;

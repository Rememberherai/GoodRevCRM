import { z } from 'zod';

// Valid FullEnrich enrich_fields values
const ENRICH_FIELD_OPTIONS = ['contact.emails', 'contact.personal_emails', 'contact.phones'] as const;
export type EnrichFieldOption = typeof ENRICH_FIELD_OPTIONS[number];

// Schema for enriching a single person
export const enrichPersonSchema = z.object({
  person_id: z.string().uuid('Invalid person ID'),
  enrich_fields: z.array(z.enum(ENRICH_FIELD_OPTIONS)).min(1).optional(),
});

export type EnrichPersonInput = z.infer<typeof enrichPersonSchema>;

// Schema for bulk enrichment
export const bulkEnrichSchema = z.object({
  person_ids: z
    .array(z.string().uuid('Invalid person ID'))
    .min(1, 'At least one person is required')
    .max(100, 'Maximum 100 people per batch'),
  enrich_fields: z.array(z.enum(ENRICH_FIELD_OPTIONS)).min(1).optional(),
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

// FullEnrich v2 webhook schema (same format as GET response)
const v2ContactInfoSchema = z.object({
  most_probable_work_email: z.object({
    email: z.string(),
    status: z.string().optional(),
  }).nullable().optional(),
  most_probable_personal_email: z.object({
    email: z.string(),
    status: z.string().optional(),
  }).nullable().optional(),
  most_probable_phone: z.object({
    number: z.string(),
    region: z.string().optional(),
  }).nullable().optional(),
  work_emails: z.array(z.object({
    email: z.string(),
    status: z.string().optional(),
  })).optional(),
  personal_emails: z.array(z.object({
    email: z.string(),
    status: z.string().optional(),
  })).optional(),
  phones: z.array(z.object({
    number: z.string(),
    region: z.string().optional(),
  })).optional(),
}).nullable().optional();

const v2ProfileSchema = z.object({
  id: z.string().optional(),
  full_name: z.string().nullable().optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  location: z.object({
    country: z.string().nullable().optional(),
    country_code: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
  }).nullable().optional(),
  social_profiles: z.object({
    linkedin: z.object({
      url: z.string().optional(),
      handle: z.string().optional(),
    }).optional(),
  }).nullable().optional(),
  employment: z.object({
    current: z.object({
      title: z.string().optional(),
      company: z.object({
        name: z.string().optional(),
        domain: z.string().optional(),
      }).optional(),
    }).nullable().optional(),
  }).nullable().optional(),
}).nullable().optional();

const enrichmentRecordSchema = z.object({
  input: z.object({
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    full_name: z.string().optional(),
    company_domain: z.string().optional(),
    company_name: z.string().optional(),
    linkedin_url: z.string().optional(),
  }).optional(),
  custom: z.record(z.string(), z.unknown()).optional(),
  contact_info: v2ContactInfoSchema,
  profile: v2ProfileSchema,
  error: z.string().nullable().optional(),
});

// V2 webhook schema (FullEnrich native format)
const v2WebhookSchema = z.object({
  enrichment_id: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  status: z.enum(['CREATED', 'IN_PROGRESS', 'CANCELED', 'CREDITS_INSUFFICIENT', 'FINISHED', 'RATE_LIMIT', 'UNKNOWN'] as const),
  cost: z.object({
    credits: z.number(),
  }).optional(),
  data: z.array(enrichmentRecordSchema).optional(),
  error: z.string().optional(),
});

export const enrichmentWebhookSchema = v2WebhookSchema;

export type EnrichmentWebhookPayload = z.infer<typeof enrichmentWebhookSchema>;
export type EnrichmentRecord = z.infer<typeof enrichmentRecordSchema>;

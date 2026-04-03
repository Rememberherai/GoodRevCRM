import { z } from 'zod';
import crypto from 'crypto';

// FullEnrich API v2 configuration
const FULLENRICH_API_URL = 'https://app.fullenrich.com/api/v2';

// FullEnrich API v2 response schemas
// V2 uses "data" array with "contact_info" and "profile" objects

const fullEnrichV2EmailSchema = z.object({
  email: z.string(),
  status: z.enum(['DELIVERABLE', 'HIGH_PROBABILITY', 'CATCH_ALL', 'INVALID', 'INVALID_DOMAIN']).optional(),
});

const fullEnrichV2PhoneSchema = z.object({
  number: z.string(),
  region: z.string().optional(),
});

const fullEnrichV2ContactInfoSchema = z.object({
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
  work_emails: z.array(fullEnrichV2EmailSchema).optional(),
  personal_emails: z.array(fullEnrichV2EmailSchema).optional(),
  phones: z.array(fullEnrichV2PhoneSchema).optional(),
}).nullable().optional();

const fullEnrichV2ProfileSchema = z.object({
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

const fullEnrichV2RecordSchema = z.object({
  input: z.object({
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    full_name: z.string().optional(),
    company_domain: z.string().optional(),
    company_name: z.string().optional(),
    linkedin_url: z.string().optional(),
  }).optional(),
  custom: z.record(z.string(), z.unknown()).optional(),
  contact_info: fullEnrichV2ContactInfoSchema,
  profile: fullEnrichV2ProfileSchema,
  error: z.string().nullable().optional(),
});

export type FullEnrichRecord = z.infer<typeof fullEnrichV2RecordSchema>;

// Raw FullEnrich API v2 response schema (for GET result and webhook)
const fullEnrichApiResponseSchema = z.object({
  enrichment_id: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  status: z.enum(['CREATED', 'IN_PROGRESS', 'CANCELED', 'CREDITS_INSUFFICIENT', 'FINISHED', 'RATE_LIMIT', 'UNKNOWN']),
  cost: z.object({
    credits: z.number(),
  }).optional(),
  data: z.array(fullEnrichV2RecordSchema).optional(),
  error: z.string().optional(),
});

// Transform FullEnrich v2 response to our normalized format
const enrichmentJobResponseSchema = fullEnrichApiResponseSchema.transform((data) => {
  let status: 'pending' | 'processing' | 'completed' | 'failed';
  switch (data.status) {
    case 'FINISHED':
      status = 'completed';
      break;
    case 'CREATED':
    case 'IN_PROGRESS':
      status = 'processing';
      break;
    case 'CANCELED':
    case 'CREDITS_INSUFFICIENT':
    case 'RATE_LIMIT':
      status = 'failed';
      break;
    default:
      status = 'pending';
  }

  const results = data.data?.map((record) => {
    const contactInfo = record.contact_info;
    const profile = record.profile;
    const custom = record.custom as Record<string, unknown> | undefined;

    // Map phones from v2 format (number + region) to our format (phone + type)
    const allPhones = contactInfo?.phones?.map((p) => ({
      phone: p.number,
      type: 'mobile' as string,
      status: undefined as string | undefined,
      region: p.region,
    })) ?? [];

    // Combine work and personal emails into a unified list
    const workEmails = (contactInfo?.work_emails ?? []).map((e) => ({
      email: e.email,
      status: e.status,
      type: 'work' as string,
    }));
    const personalEmails = (contactInfo?.personal_emails ?? []).map((e) => ({
      email: e.email,
      status: e.status,
      type: 'personal' as string,
    }));
    const allEmails = [...workEmails, ...personalEmails];

    // Extract linkedin_url from profile
    const linkedinUrl = profile?.social_profiles?.linkedin?.url ?? null;

    // Extract job title from current employment
    const jobTitle = profile?.employment?.current?.title ?? null;

    // Extract company info from current employment
    const companyName = profile?.employment?.current?.company?.name ?? null;
    const companyDomain = profile?.employment?.current?.company?.domain ?? null;

    return {
      email: contactInfo?.most_probable_work_email?.email ?? allEmails[0]?.email ?? null,
      first_name: profile?.first_name ?? null,
      last_name: profile?.last_name ?? null,
      full_name: profile?.full_name ?? null,
      job_title: jobTitle,
      company_name: companyName,
      company_domain: companyDomain,
      linkedin_url: linkedinUrl,
      phone: contactInfo?.most_probable_phone?.number ?? allPhones[0]?.phone ?? null,
      location: profile?.location ? {
        city: profile.location.city ?? null,
        state: profile.location.region ?? null,
        country: profile.location.country ?? null,
      } : null,
      work_email: contactInfo?.most_probable_work_email?.email ??
                  workEmails[0]?.email ?? null,
      personal_email: contactInfo?.most_probable_personal_email?.email ??
                      personalEmails[0]?.email ?? null,
      mobile_phone: allPhones[0]?.phone ?? null,
      work_phone: null as string | null,
      confidence_score: null as number | null,
      all_emails: allEmails,
      all_phones: allPhones,
      _custom: custom,
    };
  }) ?? null;

  return {
    id: data.enrichment_id ?? data.id ?? '',
    status,
    created_at: new Date().toISOString(),
    completed_at: status === 'completed' ? new Date().toISOString() : null,
    results,
    error: data.status === 'CREDITS_INSUFFICIENT' ? 'Insufficient credits' :
           data.status === 'RATE_LIMIT' ? 'Rate limit exceeded' :
           data.status === 'CANCELED' ? 'Enrichment canceled' :
           data.error ?? null,
    credits_used: data.cost?.credits ?? null,
  };
});

const enrichmentRequestSchema = z.object({
  enrichment_id: z.string(),
}).transform((data) => ({
  id: data.enrichment_id,
  status: 'processing' as const,
  estimated_completion: null,
}));

// Extended EnrichmentPerson type with raw arrays for user selection
export interface EnrichmentPerson {
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  job_title: string | null;
  company_name: string | null;
  company_domain: string | null;
  linkedin_url: string | null;
  phone: string | null;
  location: {
    city: string | null;
    state: string | null;
    country: string | null;
  } | null;
  work_email: string | null;
  personal_email: string | null;
  mobile_phone: string | null;
  work_phone: string | null;
  confidence_score: number | null;
  // Raw arrays for user selection in review modal
  all_emails?: { email: string; status?: string; type?: string }[];
  all_phones?: { phone: string; status?: string; type?: string; region?: string }[];
  // Custom fields passed through for matching (internal use)
  _custom?: Record<string, unknown>;
}

export type EnrichmentJobResponse = z.infer<typeof enrichmentJobResponseSchema>;
export type EnrichmentRequest = z.infer<typeof enrichmentRequestSchema>;

// Enrichment status
export type EnrichmentStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Error class
export class FullEnrichError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseBody?: unknown
  ) {
    super(message);
    this.name = 'FullEnrichError';
  }
}

// Input types for enrichment
export interface EnrichPersonInput {
  email?: string;
  linkedin_url?: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  company_domain?: string;
  // Custom fields to pass through for result matching
  person_id?: string;
  job_id?: string;
}

export interface BulkEnrichInput {
  people: EnrichPersonInput[];
  webhook_url?: string;
  enrich_fields?: string[];
}

// Client class
export class FullEnrichClient {
  private apiKey: string;

  constructor(options?: { apiKey?: string }) {
    const apiKey = options?.apiKey ?? process.env.FULLENRICH_API_KEY;
    if (!apiKey) {
      throw new FullEnrichError('FULLENRICH_API_KEY is required');
    }
    this.apiKey = apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    schema?: z.ZodSchema<T>
  ): Promise<T> {
    const url = `${FULLENRICH_API_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }
      throw new FullEnrichError(
        `FullEnrich API error: ${response.status} ${response.statusText}`,
        response.status,
        errorBody
      );
    }

    const data = await response.json();

    // Log raw API response for debugging enrichment issues
    console.log(`[FullEnrich] Raw response for ${endpoint}:`, JSON.stringify(data, null, 2));

    if (schema) {
      const parsed = schema.safeParse(data);
      if (!parsed.success) {
        console.error('[FullEnrich] Zod parse error:', parsed.error.message, 'Raw data:', JSON.stringify(data));
        throw new FullEnrichError(
          'Invalid response from FullEnrich API',
          undefined,
          data
        );
      }
      return parsed.data;
    }

    return data as T;
  }

  /**
   * Start bulk enrichment
   * V2 API uses "data" array with first_name/last_name (not firstname/lastname)
   */
  async startBulkEnrich(input: BulkEnrichInput): Promise<EnrichmentRequest> {
    const fields = input.enrich_fields ?? ['contact.emails', 'contact.phones'];
    const payload = {
      name: `enrichment-${Date.now()}`,
      webhook_url: input.webhook_url,
      data: input.people.map((p) => ({
        first_name: p.first_name,
        last_name: p.last_name,
        domain: p.company_domain,
        company_name: p.company_name,
        linkedin_url: p.linkedin_url,
        enrich_fields: fields,
        custom: {
          person_id: p.person_id ?? '',
          job_id: p.job_id ?? '',
        },
      })),
    };

    console.log('[FullEnrich] Sending v2 bulk enrich:',
      JSON.stringify(payload.data.map(d => ({
        name: `${d.first_name} ${d.last_name}`,
        custom: d.custom,
        enrich_fields: d.enrich_fields,
      })), null, 2)
    );

    return this.request(
      '/contact/enrich/bulk?silentFail=true',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      enrichmentRequestSchema
    );
  }

  /**
   * Enrich a single person (uses bulk endpoint with one person)
   * Note: This is async - results come via webhook
   */
  async enrichPerson(input: EnrichPersonInput, webhookUrl?: string, enrichFields?: string[]): Promise<EnrichmentRequest> {
    return this.startBulkEnrich({
      people: [input],
      webhook_url: webhookUrl,
      enrich_fields: enrichFields,
    });
  }

  /**
   * Get the status/results of a bulk enrichment job
   */
  async getJobStatus(jobId: string): Promise<EnrichmentJobResponse> {
    return this.request(
      `/contact/enrich/bulk/${jobId}`,
      { method: 'GET' },
      enrichmentJobResponseSchema
    );
  }

  /**
   * Get available credits
   */
  async getCredits(): Promise<{ available: number; used: number }> {
    return this.request('/workspace/credits', { method: 'GET' });
  }

  /**
   * Verify webhook signature (for webhook handler)
   */
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  }
}

// Singleton instance for server-side usage
let clientInstance: FullEnrichClient | null = null;

export function getFullEnrichClient(): FullEnrichClient {
  if (!clientInstance) {
    clientInstance = new FullEnrichClient();
  }
  return clientInstance;
}

/**
 * Get a FullEnrich client using the project's stored API key (with env var fallback).
 */
export async function getProjectFullEnrichClient(
  projectId: string
): Promise<FullEnrichClient> {
  const { getProjectSecret, ApiKeyMissingError } = await import('@/lib/secrets');
  const apiKey = await getProjectSecret(projectId, 'fullenrich_api_key');
  if (!apiKey) {
    throw new ApiKeyMissingError('fullenrich_api_key', 'FullEnrich API Key');
  }
  return new FullEnrichClient({ apiKey });
}

// Helper to create a new client (useful for testing)
export function createFullEnrichClient(
  options?: { apiKey?: string }
): FullEnrichClient {
  return new FullEnrichClient(options);
}

// Field mapping from FullEnrich response to our Person type
export const FULLENRICH_FIELD_MAPPINGS: Record<string, string> = {
  email: 'email',
  work_email: 'email',
  first_name: 'first_name',
  last_name: 'last_name',
  job_title: 'job_title',
  linkedin_url: 'linkedin_url',
  phone: 'phone',
  mobile_phone: 'phone',
  work_phone: 'phone',
  'location.city': 'address_city',
  'location.state': 'address_state',
  'location.country': 'address_country',
};

// Helper to map enrichment result to person updates
export function mapEnrichmentToPerson(
  enrichment: EnrichmentPerson,
  currentPerson: Record<string, unknown>
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};

  // Map standard fields
  if (enrichment.email && !currentPerson.email) {
    updates.email = enrichment.email;
  }
  if (enrichment.work_email && !currentPerson.email) {
    updates.email = enrichment.work_email;
  }
  if (enrichment.job_title && !currentPerson.job_title) {
    updates.job_title = enrichment.job_title;
  }
  if (enrichment.linkedin_url && !currentPerson.linkedin_url) {
    updates.linkedin_url = enrichment.linkedin_url;
  }
  if (enrichment.phone && !currentPerson.phone) {
    updates.phone = enrichment.phone;
  }
  if (enrichment.mobile_phone && !currentPerson.phone) {
    updates.phone = enrichment.mobile_phone;
  }
  if (enrichment.location) {
    if (enrichment.location.city && !currentPerson.address_city) {
      updates.address_city = enrichment.location.city;
    }
    if (enrichment.location.state && !currentPerson.address_state) {
      updates.address_state = enrichment.location.state;
    }
    if (enrichment.location.country && !currentPerson.address_country) {
      updates.address_country = enrichment.location.country;
    }
  }

  return updates;
}

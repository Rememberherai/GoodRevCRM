import { z } from 'zod';
import crypto from 'crypto';

// FullEnrich API configuration
// NOTE: Using v1 API - v2 has different response format that doesn't work
const FULLENRICH_API_URL = 'https://app.fullenrich.com/api/v1';

// FullEnrich API v1 response schemas (matches rebel-enrich working format)
// V1 uses "datas" array with "contact" object inside each record
const fullEnrichV1ContactSchema = z.object({
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

const fullEnrichV1RecordSchema = z.object({
  contact: fullEnrichV1ContactSchema,
  custom: z.record(z.string(), z.unknown()).optional(),
  error: z.string().nullable().optional(),
});

// Raw FullEnrich API v1 response schema
const fullEnrichApiResponseSchema = z.object({
  enrichment_id: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  status: z.enum(['CREATED', 'IN_PROGRESS', 'CANCELED', 'CREDITS_INSUFFICIENT', 'FINISHED', 'RATE_LIMIT', 'UNKNOWN']),
  cost: z.object({
    credits: z.number(),
  }).optional(),
  datas: z.array(fullEnrichV1RecordSchema).optional(),
  error: z.string().optional(),
});

// Transform FullEnrich v1 response to our normalized format
const enrichmentJobResponseSchema = fullEnrichApiResponseSchema.transform((data) => {
  // Map FullEnrich status to our internal status
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

  // Transform v1 datas records to our EnrichmentPerson format
  // V1 uses: datas[].contact with phones[], emails[], most_probable_phone, etc.
  const results = data.datas?.map((record) => {
    const contact = record.contact;
    const profile = contact?.profile;
    const custom = record.custom as Record<string, unknown> | undefined;

    // Map phones from v1 format (number field) to our format (phone field)
    const allPhones = contact?.phones?.map((p: { number: string; type?: string; status?: string }) => ({
      phone: p.number,
      type: p.type ?? 'mobile', // FullEnrich specializes in mobile
      status: p.status,
    })) ?? [];

    // Emails are already in correct format
    const allEmails = contact?.emails ?? [];

    return {
      email: contact?.most_probable_email ?? allEmails[0]?.email ?? null,
      first_name: profile?.first_name ?? null,
      last_name: profile?.last_name ?? null,
      full_name: profile?.full_name ?? null,
      job_title: profile?.job_title ?? null,
      company_name: profile?.company ?? null,
      company_domain: null,
      linkedin_url: profile?.linkedin_url ?? null,
      phone: contact?.most_probable_phone ?? allPhones[0]?.phone ?? null,
      location: profile?.location ? {
        city: profile.location.city ?? null,
        state: profile.location.state ?? null,
        country: profile.location.country ?? null,
      } : null,
      work_email: allEmails.find((e: { type?: string }) => e.type === 'work')?.email ?? null,
      personal_email: contact?.most_probable_personal_email ??
                      allEmails.find((e: { type?: string }) => e.type === 'personal')?.email ?? null,
      mobile_phone: allPhones.find((p: { type?: string }) => p.type === 'mobile')?.phone ?? null,
      work_phone: allPhones.find((p: { type?: string }) => p.type === 'work')?.phone ?? null,
      confidence_score: null,
      // Include raw arrays for user selection in review modal
      all_emails: allEmails,
      all_phones: allPhones,
      // Pass through custom fields for matching (person_id, job_id)
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
export type FullEnrichRecord = z.infer<typeof fullEnrichV1RecordSchema>;

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

    if (schema) {
      const parsed = schema.safeParse(data);
      if (!parsed.success) {
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
   * Start bulk enrichment (FullEnrich only supports async bulk enrichment)
   * For single person, pass array with one person
   * NOTE: v1 API uses "datas" array (not "data")
   */
  async startBulkEnrich(input: BulkEnrichInput): Promise<EnrichmentRequest> {
    const payload = {
      name: `enrichment-${Date.now()}`,
      webhook_url: input.webhook_url,
      datas: input.people.map((p) => ({
        firstname: p.first_name,
        lastname: p.last_name,
        domain: p.company_domain,
        company_name: p.company_name,
        linkedin_url: p.linkedin_url,
        email: p.email, // Optional hint
        enrich_fields: ['contact.emails', 'contact.phones'],
        // Pass person_id and job_id through custom field for reliable result matching
        custom: {
          person_id: p.person_id,
          job_id: p.job_id,
        },
      })),
    };

    console.log('[FullEnrich] Sending bulk enrich with custom fields:',
      JSON.stringify(payload.datas.map(d => ({
        name: `${d.firstname} ${d.lastname}`,
        custom: d.custom
      })), null, 2)
    );

    return this.request(
      '/contact/enrich/bulk',
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
  async enrichPerson(input: EnrichPersonInput, webhookUrl?: string): Promise<EnrichmentRequest> {
    return this.startBulkEnrich({
      people: [input],
      webhook_url: webhookUrl,
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

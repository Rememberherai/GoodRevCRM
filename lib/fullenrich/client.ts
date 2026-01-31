import { z } from 'zod';

// FullEnrich API configuration
const FULLENRICH_API_URL = 'https://app.fullenrich.com/api/v2';

// Response schemas
const enrichmentPersonSchema = z.object({
  email: z.string().nullable(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  full_name: z.string().nullable(),
  job_title: z.string().nullable(),
  company_name: z.string().nullable(),
  company_domain: z.string().nullable(),
  linkedin_url: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.object({
    city: z.string().nullable(),
    state: z.string().nullable(),
    country: z.string().nullable(),
  }).nullable(),
  work_email: z.string().nullable(),
  personal_email: z.string().nullable(),
  mobile_phone: z.string().nullable(),
  work_phone: z.string().nullable(),
  confidence_score: z.number().nullable(),
});

const enrichmentJobResponseSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  created_at: z.string(),
  completed_at: z.string().nullable(),
  results: z.array(enrichmentPersonSchema).nullable(),
  error: z.string().nullable(),
  credits_used: z.number().nullable(),
});

const enrichmentRequestSchema = z.object({
  enrichment_id: z.string(),
}).transform((data) => ({
  id: data.enrichment_id,
  status: 'processing' as const,
  estimated_completion: null,
}));

export type EnrichmentPerson = z.infer<typeof enrichmentPersonSchema>;
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
   */
  async startBulkEnrich(input: BulkEnrichInput): Promise<EnrichmentRequest> {
    const payload = {
      name: `enrichment-${Date.now()}`,
      webhook_url: input.webhook_url,
      data: input.people.map((p) => ({
        first_name: p.first_name,
        last_name: p.last_name,
        domain: p.company_domain,
        company_name: p.company_name,
        linkedin_url: p.linkedin_url,
        enrich_fields: ['contact.emails', 'contact.phones'],
      })),
    };

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
    // Implementation depends on FullEnrich's webhook signature method
    // Typically HMAC-SHA256
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
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

import { z } from 'zod';
import { getOpenRouterClient, FAST_MODEL, type OpenRouterRequestOptions } from './client';

// Simple JSON schema types for prompts (no Zod internal API dependency)
export interface JsonSchemaProperty {
  type: string | string[];
  properties?: Record<string, JsonSchemaProperty>;
  items?: JsonSchemaProperty;
  required?: string[];
  enum?: string[];
  format?: string;
  oneOf?: JsonSchemaProperty[];
}

// Manual JSON schema builder (doesn't use Zod internals)
// This is intentionally simple - for complex schemas, describe them in the prompt
export function buildJsonSchemaDescription(schemaName: string): string {
  // Pre-defined schemas for our use cases
  const schemas: Record<string, JsonSchemaProperty> = {
    organizationResearch: {
      type: 'object',
      properties: {
        company_name: { type: ['string', 'null'] },
        website: { type: ['string', 'null'] },
        industry: { type: ['string', 'null'] },
        employee_count: { type: ['number', 'null'] },
        annual_revenue: { type: ['string', 'null'] },
        description: { type: ['string', 'null'] },
        headquarters: {
          type: ['object', 'null'],
          properties: {
            city: { type: ['string', 'null'] },
            state: { type: ['string', 'null'] },
            country: { type: ['string', 'null'] },
          },
        },
        founded_year: { type: ['number', 'null'] },
        key_products: { type: ['array', 'null'], items: { type: 'string' } },
        competitors: { type: ['array', 'null'], items: { type: 'string' } },
        recent_news: {
          type: ['array', 'null'],
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              date: { type: ['string', 'null'] },
              summary: { type: 'string' },
            },
          },
        },
        custom_fields: { type: 'object' },
        confidence_scores: { type: 'object' },
      },
    },
    personResearch: {
      type: 'object',
      properties: {
        full_name: { type: ['string', 'null'] },
        current_title: { type: ['string', 'null'] },
        current_company: { type: ['string', 'null'] },
        email: { type: ['string', 'null'] },
        phone: { type: ['string', 'null'] },
        linkedin_url: { type: ['string', 'null'] },
        location: {
          type: ['object', 'null'],
          properties: {
            city: { type: ['string', 'null'] },
            state: { type: ['string', 'null'] },
            country: { type: ['string', 'null'] },
          },
        },
        education: {
          type: ['array', 'null'],
          items: {
            type: 'object',
            properties: {
              institution: { type: 'string' },
              degree: { type: ['string', 'null'] },
              year: { type: ['number', 'null'] },
            },
          },
        },
        work_history: {
          type: ['array', 'null'],
          items: {
            type: 'object',
            properties: {
              company: { type: 'string' },
              title: { type: 'string' },
              start_year: { type: ['number', 'null'] },
              end_year: { type: ['number', 'null'] },
            },
          },
        },
        skills: { type: ['array', 'null'], items: { type: 'string' } },
        bio: { type: ['string', 'null'] },
        custom_fields: { type: 'object' },
        confidence_scores: { type: 'object' },
      },
    },
  };

  const schema = schemas[schemaName];
  if (!schema) {
    return '{}';
  }
  return JSON.stringify(schema, null, 2);
}

// Generate a prompt that instructs the model to output JSON matching a schema
export function generateStructuredPrompt(
  schemaName: string,
  instructions: string,
  context?: string
): string {
  const jsonSchema = buildJsonSchemaDescription(schemaName);

  let prompt = `${instructions}

You must respond with valid JSON that matches this schema:
\`\`\`json
${jsonSchema}
\`\`\`

IMPORTANT: Respond ONLY with valid JSON. Do not include any explanations, markdown formatting, or additional text.`;

  if (context) {
    prompt = `Context:
${context}

${prompt}`;
  }

  return prompt;
}

// Execute a structured output request
export async function getStructuredOutput<T>(
  schema: z.ZodSchema<T>,
  schemaName: string,
  instructions: string,
  context?: string,
  options?: OpenRouterRequestOptions
): Promise<T> {
  const client = getOpenRouterClient();
  const prompt = generateStructuredPrompt(schemaName, instructions, context);

  return client.completeJson(prompt, schema, {
    model: FAST_MODEL,
    temperature: 0.3, // Lower temperature for more consistent structured output
    ...options,
  });
}

// Batch structured output requests
export async function getStructuredOutputBatch<T>(
  schema: z.ZodSchema<T>,
  schemaName: string,
  items: { instructions: string; context?: string }[],
  options?: OpenRouterRequestOptions
): Promise<({ success: T; error: null } | { success: null; error: Error })[]> {
  const results = await Promise.allSettled(
    items.map((item) =>
      getStructuredOutput(schema, schemaName, item.instructions, item.context, options)
    )
  );

  return results.map((result) => {
    if (result.status === 'fulfilled') {
      return { success: result.value, error: null };
    } else {
      return { success: null, error: result.reason as Error };
    }
  });
}

// Common structured output schemas
export const extractedFieldSchema = z.object({
  field_name: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  confidence: z.number().min(0).max(1),
  source: z.string().optional(),
});

export const extractedFieldsSchema = z.object({
  fields: z.array(extractedFieldSchema),
  summary: z.string().optional(),
});

export type ExtractedField = z.infer<typeof extractedFieldSchema>;
export type ExtractedFields = z.infer<typeof extractedFieldsSchema>;

// Schema for organization research
export const organizationResearchSchema = z.object({
  company_name: z.string().nullable(),
  website: z.string().nullable(),
  industry: z.string().nullable(),
  employee_count: z.number().nullable(),
  annual_revenue: z.string().nullable(),
  description: z.string().nullable(),
  headquarters: z.object({
    city: z.string().nullable(),
    state: z.string().nullable(),
    country: z.string().nullable(),
  }).nullable(),
  founded_year: z.number().nullable(),
  key_products: z.array(z.string()).nullable(),
  competitors: z.array(z.string()).nullable(),
  recent_news: z.array(z.object({
    title: z.string(),
    date: z.string().nullable(),
    summary: z.string(),
  })).nullable(),
  custom_fields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  confidence_scores: z.record(z.string(), z.number()).optional(),
});

export type OrganizationResearch = z.infer<typeof organizationResearchSchema>;

// Schema for person research
export const personResearchSchema = z.object({
  full_name: z.string().nullable(),
  current_title: z.string().nullable(),
  current_company: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  linkedin_url: z.string().nullable(),
  location: z.object({
    city: z.string().nullable(),
    state: z.string().nullable(),
    country: z.string().nullable(),
  }).nullable(),
  education: z.array(z.object({
    institution: z.string(),
    degree: z.string().nullable(),
    year: z.number().nullable(),
  })).nullable(),
  work_history: z.array(z.object({
    company: z.string(),
    title: z.string(),
    start_year: z.number().nullable(),
    end_year: z.number().nullable(),
  })).nullable(),
  skills: z.array(z.string()).nullable(),
  bio: z.string().nullable(),
  custom_fields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  confidence_scores: z.record(z.string(), z.number()).optional(),
});

export type PersonResearch = z.infer<typeof personResearchSchema>;

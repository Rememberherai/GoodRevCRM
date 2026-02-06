import { z } from 'zod';

// OpenRouter API configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Response schemas
const openRouterMessageSchema = z.object({
  role: z.enum(['assistant', 'user', 'system']),
  content: z.string(),
});

const openRouterChoiceSchema = z.object({
  index: z.number(),
  message: openRouterMessageSchema,
  finish_reason: z.string().nullable(),
});

const openRouterUsageSchema = z.object({
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  total_tokens: z.number(),
});

const openRouterResponseSchema = z.object({
  id: z.string(),
  model: z.string(),
  choices: z.array(openRouterChoiceSchema),
  usage: openRouterUsageSchema.optional(),
});

export type OpenRouterResponse = z.infer<typeof openRouterResponseSchema>;
export type OpenRouterMessage = z.infer<typeof openRouterMessageSchema>;
export type OpenRouterUsage = z.infer<typeof openRouterUsageSchema>;

// Error types
export class OpenRouterError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseBody?: unknown
  ) {
    super(message);
    this.name = 'OpenRouterError';
  }
}

// Model options
export type OpenRouterModel =
  | 'anthropic/claude-3.5-sonnet'
  | 'anthropic/claude-3-haiku'
  | 'openai/gpt-4o'
  | 'openai/gpt-4o-mini'
  | 'google/gemini-pro-1.5'
  | 'meta-llama/llama-3.1-70b-instruct';

export const DEFAULT_MODEL: OpenRouterModel = 'anthropic/claude-3.5-sonnet';
export const FAST_MODEL: OpenRouterModel = 'anthropic/claude-3-haiku';

// Request options
export interface OpenRouterRequestOptions {
  model?: OpenRouterModel | string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  responseFormat?: 'text' | 'json_object';
  systemPrompt?: string;
}

// Client class
export class OpenRouterClient {
  private apiKey: string;
  private siteUrl: string;
  private siteName: string;

  constructor(options?: { apiKey?: string; siteUrl?: string; siteName?: string }) {
    const apiKey = options?.apiKey ?? process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new OpenRouterError('OPENROUTER_API_KEY is required');
    }
    this.apiKey = apiKey;
    this.siteUrl = options?.siteUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    this.siteName = options?.siteName ?? 'GoodRev CRM';
  }

  async chat(
    messages: OpenRouterMessage[],
    options: OpenRouterRequestOptions = {}
  ): Promise<OpenRouterResponse> {
    const {
      model = DEFAULT_MODEL,
      temperature = 0.7,
      maxTokens = 4096,
      topP = 1,
      responseFormat,
    } = options;

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      top_p: topP,
    };

    if (responseFormat === 'json_object') {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': this.siteUrl,
        'X-Title': this.siteName,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }
      console.error('[OpenRouter] API error:', response.status, errorBody);
      throw new OpenRouterError(
        `OpenRouter API error: ${response.status} ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    const parsed = openRouterResponseSchema.safeParse(data);

    if (!parsed.success) {
      throw new OpenRouterError(
        'Invalid response from OpenRouter API',
        undefined,
        data
      );
    }

    return parsed.data;
  }

  async complete(
    prompt: string,
    options: OpenRouterRequestOptions = {}
  ): Promise<string> {
    const response = await this.chat(
      [{ role: 'user', content: prompt }],
      options
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new OpenRouterError('No content in response');
    }

    return content;
  }

  async completeWithSystem(
    systemPrompt: string,
    userPrompt: string,
    options: OpenRouterRequestOptions = {}
  ): Promise<string> {
    const response = await this.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      options
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new OpenRouterError('No content in response');
    }

    return content;
  }

  async completeJson<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    options: OpenRouterRequestOptions = {}
  ): Promise<T> {
    const { systemPrompt, ...restOptions } = options;

    let response: string;
    if (systemPrompt) {
      response = await this.completeWithSystem(systemPrompt, prompt, {
        ...restOptions,
        responseFormat: 'json_object',
      });
    } else {
      response = await this.complete(prompt, {
        ...restOptions,
        responseFormat: 'json_object',
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(response);
    } catch {
      throw new OpenRouterError('Failed to parse JSON response', undefined, response);
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new OpenRouterError(
        `Response validation failed: ${result.error.message}`,
        undefined,
        parsed
      );
    }

    return result.data;
  }

  async completeJsonWithUsage<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    options: OpenRouterRequestOptions = {}
  ): Promise<{ data: T; usage: OpenRouterUsage | null; model: string }> {
    const { systemPrompt, ...restOptions } = options;

    const messages: OpenRouterMessage[] = systemPrompt
      ? [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ]
      : [{ role: 'user', content: prompt }];

    const response = await this.chat(messages, {
      ...restOptions,
      responseFormat: 'json_object',
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new OpenRouterError('No content in response');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new OpenRouterError('Failed to parse JSON response', undefined, content);
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new OpenRouterError(
        `Response validation failed: ${result.error.message}`,
        undefined,
        parsed
      );
    }

    return {
      data: result.data,
      usage: response.usage ?? null,
      model: response.model,
    };
  }
}

// Singleton instance for server-side usage
let clientInstance: OpenRouterClient | null = null;

export function getOpenRouterClient(): OpenRouterClient {
  if (!clientInstance) {
    clientInstance = new OpenRouterClient();
  }
  return clientInstance;
}

// Helper to create a new client (useful for testing)
export function createOpenRouterClient(
  options?: { apiKey?: string; siteUrl?: string; siteName?: string }
): OpenRouterClient {
  return new OpenRouterClient(options);
}

import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProjectSecret } from '@/lib/secrets';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const coerceNumber = z.union([z.number(), z.string().transform(Number)]);

const receiptLineItemSchema = z.object({
  description: z.string(),
  amount: coerceNumber.nullable().optional(),
});

export const receiptExtractionSchema = z.object({
  vendor: z.string().nullable(),
  amount: coerceNumber.nullable(),
  receipt_date: z.string().nullable(),
  description: z.string().nullable(),
  account_code: z.string().nullable(),
  class_name: z.string().nullable(),
  line_items: z.array(receiptLineItemSchema).default([]),
  raw_text: z.string().nullable().optional(),
});

export type ReceiptExtraction = z.infer<typeof receiptExtractionSchema>;

interface ReceiptSource {
  storageBucket?: string;
  storagePath?: string;
  imageUrl?: string;
  contentType?: string | null;
}

function inferContentType(fileName: string, fallback?: string | null) {
  if (fallback) return fallback;
  if (fileName.endsWith('.pdf')) return 'application/pdf';
  if (fileName.endsWith('.png')) return 'image/png';
  if (fileName.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function loadSourceBytes(source: ReceiptSource) {
  if (source.storageBucket && source.storagePath) {
    const admin = createAdminClient();
    const { data, error } = await admin.storage.from(source.storageBucket).download(source.storagePath);
    if (error || !data) {
      throw new Error('Unable to load uploaded receipt from storage');
    }

    const bytes = Buffer.from(await data.arrayBuffer());
    return {
      bytes,
      contentType: inferContentType(source.storagePath, source.contentType),
    };
  }

  if (source.imageUrl) {
    const response = await fetch(source.imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch receipt image (${response.status})`);
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    return {
      bytes,
      contentType: response.headers.get('content-type') ?? inferContentType(source.imageUrl, source.contentType),
    };
  }

  throw new Error('A receipt image source is required');
}

async function callOpenRouterForJson(projectId: string, body: Record<string, unknown>) {
  const apiKey = await getProjectSecret(projectId, 'openrouter_api_key');
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured for this project');
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      'X-Title': 'GoodRev CRM',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Receipt OCR request failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Receipt OCR returned no content');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Receipt OCR returned invalid JSON');
  }

  return receiptExtractionSchema.parse(parsed);
}

async function extractFromPdf(projectId: string, bytes: Buffer, userContext?: string) {
  // Send PDF directly to Gemini as base64 — avoids pdfjs-dist DOMMatrix errors in Node
  const dataUrl = `data:application/pdf;base64,${bytes.toString('base64')}`;
  return callOpenRouterForJson(projectId, {
    model: 'google/gemini-2.5-flash',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'Extract receipt or invoice data into JSON with keys: vendor, amount, receipt_date, description, account_code, class_name, line_items.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extract the receipt. Additional context: ${userContext ?? 'None'}`,
          },
          {
            type: 'image_url',
            image_url: { url: dataUrl },
          },
        ],
      },
    ],
  });
}

async function extractFromImage(projectId: string, bytes: Buffer, contentType: string, userContext?: string) {
  const dataUrl = `data:${contentType};base64,${bytes.toString('base64')}`;
  return callOpenRouterForJson(projectId, {
    model: 'openai/gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: 'Extract receipt or invoice data into JSON with keys: vendor, amount, receipt_date, description, account_code, class_name, line_items.',
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extract the receipt. Additional context: ${userContext ?? 'None'}`,
          },
          {
            type: 'image_url',
            image_url: { url: dataUrl },
          },
        ],
      },
    ],
  });
}

export async function extractReceiptData(params: {
  projectId: string;
  storageBucket?: string;
  storagePath?: string;
  imageUrl?: string;
  contentType?: string | null;
  userContext?: string;
}): Promise<ReceiptExtraction> {
  const { bytes, contentType } = await loadSourceBytes(params);

  if (contentType === 'application/pdf') {
    return extractFromPdf(params.projectId, bytes, params.userContext);
  }

  return extractFromImage(params.projectId, bytes, contentType, params.userContext);
}

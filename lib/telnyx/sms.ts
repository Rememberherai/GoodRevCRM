// Telnyx SMS API client functions

const TELNYX_API_BASE = 'https://api.telnyx.com/v2';
const DEFAULT_TIMEOUT_MS = 30000;

interface TelnyxRequestOptions {
  apiKey: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: Record<string, unknown>;
  timeoutMs?: number;
}

async function telnyxRequest<T = unknown>(options: TelnyxRequestOptions): Promise<T> {
  const { apiKey, method = 'GET', path, body, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${TELNYX_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message =
        (errorData as { errors?: Array<{ detail?: string }> })?.errors?.[0]?.detail ||
        `Telnyx API error: ${response.status}`;
      throw new Error(message);
    }

    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Telnyx API request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// SMS-specific types
export interface SendSmsParams {
  from: string; // E.164 format phone number
  to: string; // E.164 format phone number
  body: string;
  messagingProfileId: string;
  webhookUrl?: string;
  webhookFailoverUrl?: string;
}

export interface TelnyxSmsResponse {
  data: {
    id: string; // Message UUID
    record_type: string;
    direction: string;
    from: { phone_number: string; carrier?: string; line_type?: string };
    to: Array<{ phone_number: string; status: string; carrier?: string; line_type?: string }>;
    text: string;
    parts: number;
    messaging_profile_id: string;
    type: string;
    cost?: { amount: string; currency: string };
    errors?: Array<{ code: string; title: string; detail?: string }>;
  };
}

export interface TelnyxMessageListResponse {
  data: Array<TelnyxSmsResponse['data']>;
  meta: {
    total_pages: number;
    total_results: number;
    page_number: number;
    page_size: number;
  };
}

/**
 * Send an SMS message via Telnyx
 */
export async function sendSms(
  apiKey: string,
  params: SendSmsParams
): Promise<TelnyxSmsResponse> {
  return telnyxRequest<TelnyxSmsResponse>({
    apiKey,
    method: 'POST',
    path: '/messages',
    body: {
      from: params.from,
      to: params.to,
      text: params.body,
      messaging_profile_id: params.messagingProfileId,
      type: 'SMS',
      ...(params.webhookUrl ? { webhook_url: params.webhookUrl } : {}),
      ...(params.webhookFailoverUrl ? { webhook_failover_url: params.webhookFailoverUrl } : {}),
    },
  });
}

/**
 * Get details of a specific message
 */
export async function getMessage(
  apiKey: string,
  messageId: string
): Promise<TelnyxSmsResponse> {
  return telnyxRequest<TelnyxSmsResponse>({
    apiKey,
    path: `/messages/${messageId}`,
  });
}

/**
 * List messages with filters
 */
export async function listMessages(
  apiKey: string,
  filters: {
    messagingProfileId?: string;
    direction?: 'inbound' | 'outbound';
    fromNumber?: string;
    toNumber?: string;
    pageSize?: number;
    pageNumber?: number;
  } = {}
): Promise<TelnyxMessageListResponse> {
  const params = new URLSearchParams();

  if (filters.messagingProfileId) {
    params.set('filter[messaging_profile_id]', filters.messagingProfileId);
  }
  if (filters.direction) {
    params.set('filter[direction]', filters.direction);
  }
  if (filters.fromNumber) {
    params.set('filter[from]', filters.fromNumber);
  }
  if (filters.toNumber) {
    params.set('filter[to]', filters.toNumber);
  }
  if (filters.pageSize) {
    params.set('page[size]', String(filters.pageSize));
  }
  if (filters.pageNumber) {
    params.set('page[number]', String(filters.pageNumber));
  }

  const queryString = params.toString();
  return telnyxRequest<TelnyxMessageListResponse>({
    apiKey,
    path: `/messages${queryString ? `?${queryString}` : ''}`,
  });
}

/**
 * Normalize phone number to E.164 format
 * Strips common formatting and ensures + prefix for US numbers
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-numeric characters except +
  let normalized = phone.replace(/[^\d+]/g, '');

  // If starts with +, keep as is
  if (normalized.startsWith('+')) {
    return normalized;
  }

  // If 10 digits, assume US and add +1
  if (normalized.length === 10) {
    return `+1${normalized}`;
  }

  // If 11 digits starting with 1, add +
  if (normalized.length === 11 && normalized.startsWith('1')) {
    return `+${normalized}`;
  }

  // Otherwise add + prefix
  return `+${normalized}`;
}

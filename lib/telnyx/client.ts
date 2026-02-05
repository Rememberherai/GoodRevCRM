// Telnyx REST API client wrapper (Call Control V2)

const TELNYX_API_BASE = 'https://api.telnyx.com/v2';
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

interface TelnyxRequestOptions {
  apiKey: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: Record<string, unknown>;
  timeoutMs?: number;
}

async function telnyxRequest<T = unknown>(options: TelnyxRequestOptions): Promise<T> {
  const { apiKey, method = 'GET', path, body, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  // Create abort controller for timeout
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

// Validate API key by listing phone numbers
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    await telnyxRequest({
      apiKey,
      path: '/phone_numbers?page[size]=1',
    });
    return true;
  } catch {
    return false;
  }
}

// List phone numbers on the account
export async function listPhoneNumbers(
  apiKey: string
): Promise<
  Array<{
    id: string;
    phone_number: string;
    connection_id: string | null;
    status: string;
  }>
> {
  const data = await telnyxRequest<{
    data: Array<{
      id: string;
      phone_number: string;
      connection_id: string | null;
      status: string;
    }>;
  }>({
    apiKey,
    path: '/phone_numbers?page[size]=100&filter[status]=active',
  });
  return data.data ?? [];
}

// Initiate an outbound call
export interface InitiateCallParams {
  connectionId: string;
  fromNumber: string;
  toNumber: string;
  webhookUrl: string;
  recordCall?: boolean;
  amdEnabled?: boolean;
  callerIdName?: string;
  clientState?: string;
}

export interface TelnyxCallResponse {
  data: {
    call_control_id: string;
    call_leg_id: string;
    call_session_id: string;
    is_alive: boolean;
    record_type: string;
  };
}

export async function initiateCall(
  apiKey: string,
  params: InitiateCallParams
): Promise<TelnyxCallResponse> {
  // Note: We don't enable recording here. Recording starts in handleCallAnswered
  // to avoid recording ringback/voicemail before actual conversation.
  return telnyxRequest<TelnyxCallResponse>({
    apiKey,
    method: 'POST',
    path: '/calls',
    body: {
      connection_id: params.connectionId,
      from: params.fromNumber,
      to: params.toNumber,
      webhook_url: params.webhookUrl,
      webhook_url_method: 'POST',
      answering_machine_detection: params.amdEnabled ? 'detect_words' : 'disabled',
      ...(params.clientState
        ? { client_state: Buffer.from(params.clientState).toString('base64') }
        : {}),
    },
  });
}

// Hang up a call
export async function hangupCall(
  apiKey: string,
  callControlId: string
): Promise<void> {
  await telnyxRequest({
    apiKey,
    method: 'POST',
    path: `/calls/${callControlId}/actions/hangup`,
    body: {},
  });
}

// Start recording
export async function startRecording(
  apiKey: string,
  callControlId: string
): Promise<void> {
  await telnyxRequest({
    apiKey,
    method: 'POST',
    path: `/calls/${callControlId}/actions/record_start`,
    body: {
      format: 'mp3',
      channels: 'dual',
    },
  });
}

// Stop recording
export async function stopRecording(
  apiKey: string,
  callControlId: string
): Promise<void> {
  await telnyxRequest({
    apiKey,
    method: 'POST',
    path: `/calls/${callControlId}/actions/record_stop`,
    body: {},
  });
}

// Get recording details
export async function getRecording(
  apiKey: string,
  recordingId: string
): Promise<{
  data: {
    id: string;
    download_urls: { mp3: string; wav: string };
    duration_millis: number;
    status: string;
  };
}> {
  return telnyxRequest({
    apiKey,
    path: `/recordings/${recordingId}`,
  });
}

// List SIP connections (for setup)
export async function listSipConnections(
  apiKey: string
): Promise<
  Array<{
    id: string;
    connection_name: string;
    active: boolean;
    record_type: string;
  }>
> {
  const data = await telnyxRequest<{
    data: Array<{
      id: string;
      connection_name: string;
      active: boolean;
      record_type: string;
    }>;
  }>({
    apiKey,
    path: '/credential_connections?page[size]=100',
  });
  return data.data ?? [];
}

// Transfer call
export async function transferCall(
  apiKey: string,
  callControlId: string,
  toNumber: string
): Promise<void> {
  await telnyxRequest({
    apiKey,
    method: 'POST',
    path: `/calls/${callControlId}/actions/transfer`,
    body: { to: toNumber },
  });
}

// Send DTMF tones
export async function sendDtmf(
  apiKey: string,
  callControlId: string,
  digits: string
): Promise<void> {
  await telnyxRequest({
    apiKey,
    method: 'POST',
    path: `/calls/${callControlId}/actions/send_dtmf`,
    body: { digits },
  });
}

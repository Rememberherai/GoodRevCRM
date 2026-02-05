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

// Transcribe a recording using Telnyx Speech-to-Text API
// Uses POST /v2/ai/audio/transcriptions with the recording's download URL
export async function transcribeRecording(
  apiKey: string,
  recordingId: string
): Promise<{ text: string; duration?: number; segments?: Array<{ start: number; end: number; text: string }> }> {
  // 1. Get fresh download URL (pre-signed S3 URLs expire)
  const recording = await getRecording(apiKey, recordingId);
  const downloadUrl = recording.data?.download_urls?.wav ?? recording.data?.download_urls?.mp3;

  if (!downloadUrl) {
    throw new Error(`No download URL available for recording ${recordingId}`);
  }

  // 2. Call Telnyx STT API with multipart/form-data
  const formData = new FormData();
  formData.append('file_url', downloadUrl);
  formData.append('model', 'openai/whisper-large-v3-turbo');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'segment');

  const controller = new AbortController();
  // Transcription can take a while for long recordings — 5 minute timeout
  const timeoutId = setTimeout(() => controller.abort(), 300000);

  try {
    const response = await fetch(`${TELNYX_API_BASE}/ai/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message =
        (errorData as { errors?: Array<{ detail?: string }> })?.errors?.[0]?.detail ||
        (errorData as { error?: { message?: string } })?.error?.message ||
        `Telnyx STT API error: ${response.status}`;
      throw new Error(message);
    }

    const result = await response.json() as {
      text: string;
      duration?: number;
      segments?: Array<{ start: number; end: number; text: string }>;
    };

    return result;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Transcription request timed out after 5 minutes');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// List recordings from Telnyx API with filters
export interface TelnyxRecording {
  id: string;
  call_leg_id: string;
  call_session_id: string;
  download_urls: { mp3: string; wav: string };
  duration_millis: number;
  channels: string;
  created_at: string;
  recording_started_at: string;
  recording_ended_at: string;
  status: string;
}

export async function listRecordings(
  apiKey: string,
  filters: {
    connectionId?: string;
    callSessionId?: string;
    from?: string;
    to?: string;
    createdAfter?: string;
  }
): Promise<TelnyxRecording[]> {
  const params = new URLSearchParams();
  params.set('page[size]', '10');

  if (filters.connectionId) {
    params.set('filter[connection_id]', filters.connectionId);
  }
  if (filters.callSessionId) {
    params.set('filter[call_session_id]', filters.callSessionId);
  }
  if (filters.from) {
    params.set('filter[from]', filters.from);
  }
  if (filters.to) {
    params.set('filter[to]', filters.to);
  }
  if (filters.createdAfter) {
    params.set('filter[created_at][gte]', filters.createdAfter);
  }

  const data = await telnyxRequest<{ data: TelnyxRecording[] }>({
    apiKey,
    path: `/recordings?${params.toString()}`,
  });

  return data.data ?? [];
}

// Telnyx webhook event processing

import { createClient } from '@supabase/supabase-js';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { DISPOSITION_TO_ACTIVITY_OUTCOME } from '@/types/call';
import { startRecording } from './client';
import { decryptApiKey } from './encryption';
import type { CallDisposition } from '@/types/call';

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

// Telnyx webhook event payload shape
export interface TelnyxWebhookEvent {
  data: {
    event_type: string;
    id: string;
    occurred_at: string;
    payload: {
      call_control_id: string;
      call_leg_id: string;
      call_session_id: string;
      connection_id: string;
      from: string;
      to: string;
      direction: 'incoming' | 'outgoing';
      state: string;
      start_time?: string;
      end_time?: string;
      // AMD fields
      result?: string; // 'human' | 'machine' | 'not_sure' | 'fax'
      // Recording fields
      recording_urls?: { mp3: string; wav: string };
      duration_millis?: number;
      recording_id?: string;
      // Client state (base64 encoded)
      client_state?: string;
    };
  };
  meta: {
    attempt: number;
    delivered_to: string;
  };
}

// Verify webhook signature using Ed25519
// Telnyx signs webhooks with their public key, and we verify using the signature header
import { createPublicKey, verify } from 'crypto';

// The public key is per-account. Get it from Telnyx Mission Control:
// Account Settings > Keys & Credentials > Public Key
// Set it as TELNYX_PUBLIC_KEY env var in PEM format or raw base64
function getTelnyxPublicKey(): string | null {
  const key = process.env.TELNYX_PUBLIC_KEY;
  if (!key) return null;

  // If it already starts with -----BEGIN, return as-is
  if (key.startsWith('-----BEGIN')) return key;

  // The key from Telnyx is a raw 32-byte Ed25519 public key in base64.
  // Node.js crypto requires SPKI (SubjectPublicKeyInfo) DER encoding which
  // prepends a 12-byte ASN.1 header: 30 2a 30 05 06 03 2b 65 70 03 21 00
  const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
  const rawKeyBytes = Buffer.from(key, 'base64');

  // If the key is already 44+ bytes, it might already be SPKI-encoded
  if (rawKeyBytes.length === 32) {
    const spkiDer = Buffer.concat([ED25519_SPKI_PREFIX, rawKeyBytes]);
    const spkiBase64 = spkiDer.toString('base64');
    return `-----BEGIN PUBLIC KEY-----\n${spkiBase64}\n-----END PUBLIC KEY-----`;
  }

  // If not 32 bytes, try wrapping as-is (might already be DER-encoded)
  return `-----BEGIN PUBLIC KEY-----\n${key}\n-----END PUBLIC KEY-----`;
}

export function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  timestamp: string | null
): boolean {
  // If no signature or timestamp, fail verification
  if (!signature || !timestamp) {
    console.warn('[Telnyx Webhook] Missing signature or timestamp headers');
    return false;
  }

  // If no public key configured, skip verification but log a warning
  const publicKeyPem = getTelnyxPublicKey();
  if (!publicKeyPem) {
    console.warn('[Telnyx Webhook] No TELNYX_PUBLIC_KEY env var configured, skipping signature verification');
    return true;
  }

  // Allow bypass in development for testing
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_WEBHOOK_VERIFICATION === 'true') {
    return true;
  }

  try {
    // The signed payload format is: timestamp|payload
    const signedPayload = `${timestamp}|${payload}`;
    const signatureBuffer = Buffer.from(signature, 'base64');

    const publicKey = createPublicKey(publicKeyPem);

    const isValid = verify(
      null, // Ed25519 doesn't use a digest algorithm
      Buffer.from(signedPayload),
      publicKey,
      signatureBuffer
    );

    if (!isValid) {
      console.warn('[Telnyx Webhook] Signature verification failed');
    }

    return isValid;
  } catch (error) {
    console.error('[Telnyx Webhook] Error verifying signature:', error);
    return false;
  }
}

// Main entry point: process a Telnyx webhook event
export async function processCallEvent(event: TelnyxWebhookEvent): Promise<void> {
  const eventType = event.data.event_type;
  const payload = event.data.payload;

  switch (eventType) {
    case 'call.initiated':
      await handleCallInitiated(payload);
      break;
    case 'call.answered':
      await handleCallAnswered(payload);
      break;
    case 'call.hangup':
      await handleCallHangup(payload);
      break;
    case 'call.machine.detection.ended':
      await handleMachineDetection(payload);
      break;
    case 'call.recording.saved':
      await handleRecordingSaved(payload);
      break;
    default:
      // Ignore unhandled event types
      console.log(`Unhandled Telnyx event: ${eventType}`);
  }
}

async function handleCallInitiated(
  payload: TelnyxWebhookEvent['data']['payload']
): Promise<void> {
  const supabase = createAdminClient();

  // Update the call record with Telnyx IDs (the record was created by the API route)
  const { error } = await supabase
    .from('calls')
    .update({
      telnyx_call_leg_id: payload.call_leg_id,
      telnyx_call_session_id: payload.call_session_id,
      status: 'ringing',
    })
    .eq('telnyx_call_control_id', payload.call_control_id);

  if (error) {
    console.error('Error updating call on initiated:', error);
  }
}

async function handleCallAnswered(
  payload: TelnyxWebhookEvent['data']['payload']
): Promise<void> {
  const supabase = createAdminClient();

  // Update call status to answered
  const { data: call, error } = await supabase
    .from('calls')
    .update({
      status: 'answered',
      answered_at: new Date().toISOString(),
    })
    .eq('telnyx_call_control_id', payload.call_control_id)
    .select('id, recording_enabled, telnyx_connection_id')
    .single();

  if (error) {
    console.error('Error updating call on answered:', error);
    return;
  }

  // Start recording NOW (after answer) if recording is enabled
  // This avoids recording ringback/voicemail before actual conversation
  if (call?.recording_enabled) {
    try {
      const { data: connection } = await supabase
        .from('telnyx_connections')
        .select('api_key')
        .eq('id', call.telnyx_connection_id)
        .single();

      if (connection?.api_key) {
        const decryptedApiKey = decryptApiKey(connection.api_key);
        await startRecording(decryptedApiKey, payload.call_control_id);
      }
    } catch (recordingError) {
      console.error('Error starting recording on call answered:', recordingError);
      // Don't fail the call if recording fails
    }
  }
}

async function handleCallHangup(
  payload: TelnyxWebhookEvent['data']['payload']
): Promise<void> {
  const supabase = createAdminClient();

  // Fetch the existing call record
  const { data: call } = await supabase
    .from('calls')
    .select('*')
    .eq('telnyx_call_control_id', payload.call_control_id)
    .single();

  if (!call) {
    console.error('Call not found for hangup:', payload.call_control_id);
    return;
  }

  const endedAt = new Date();
  const startedAt = new Date(call.started_at);
  const answeredAt = call.answered_at ? new Date(call.answered_at) : null;
  const durationSeconds = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);
  const talkTimeSeconds = answeredAt
    ? Math.round((endedAt.getTime() - answeredAt.getTime()) / 1000)
    : 0;

  // Determine final status
  let finalStatus = 'hangup';
  if (!answeredAt) {
    // Call was never answered
    if (call.amd_result === 'machine') {
      finalStatus = 'machine_detected';
    } else {
      finalStatus = 'no_answer';
    }
  }

  const { error } = await supabase
    .from('calls')
    .update({
      status: finalStatus,
      ended_at: endedAt.toISOString(),
      duration_seconds: durationSeconds,
      talk_time_seconds: talkTimeSeconds,
    })
    .eq('id', call.id);

  if (error) {
    console.error('Error updating call on hangup:', error);
    return;
  }

  // Emit automation event
  const triggerType = finalStatus === 'no_answer' || finalStatus === 'machine_detected'
    ? 'call.missed'
    : 'call.completed';

  emitAutomationEvent({
    projectId: call.project_id,
    triggerType: triggerType as 'call.completed',
    entityType: 'call',
    entityId: call.id,
    data: {
      call_id: call.id,
      direction: call.direction,
      status: finalStatus,
      duration_seconds: durationSeconds,
      talk_time_seconds: talkTimeSeconds,
      person_id: call.person_id,
      organization_id: call.organization_id,
      to_number: call.to_number,
      from_number: call.from_number,
    },
  }).catch((err) => console.error('Error emitting call automation event:', err));

  // Auto-create activity_log entry for completed calls
  if (call.person_id) {
    await createActivityFromCall(supabase, {
      ...call,
      status: finalStatus,
      ended_at: endedAt.toISOString(),
      duration_seconds: durationSeconds,
      talk_time_seconds: talkTimeSeconds,
    });
  }
}

async function handleMachineDetection(
  payload: TelnyxWebhookEvent['data']['payload']
): Promise<void> {
  const supabase = createAdminClient();

  const amdResult = payload.result as string;

  const { error } = await supabase
    .from('calls')
    .update({
      amd_result: amdResult,
      ...(amdResult === 'machine' ? { status: 'machine_detected' } : {}),
    })
    .eq('telnyx_call_control_id', payload.call_control_id);

  if (error) {
    console.error('Error updating call on AMD:', error);
  }
}

async function handleRecordingSaved(
  payload: TelnyxWebhookEvent['data']['payload']
): Promise<void> {
  const supabase = createAdminClient();

  const recordingUrl = payload.recording_urls?.mp3 ?? payload.recording_urls?.wav ?? null;
  const durationSeconds = payload.duration_millis
    ? Math.round(payload.duration_millis / 1000)
    : null;

  console.log('[Recording Webhook] Payload:', {
    call_control_id: payload.call_control_id,
    call_session_id: payload.call_session_id,
    call_leg_id: payload.call_leg_id,
    from: payload.from,
    to: payload.to,
    recording_url: recordingUrl,
  });

  // Try matching by call_control_id first (REST API calls)
  let call = null;
  let error = null;

  if (payload.call_control_id) {
    const result = await supabase
      .from('calls')
      .update({
        recording_url: recordingUrl,
        recording_duration_seconds: durationSeconds,
      })
      .eq('telnyx_call_control_id', payload.call_control_id)
      .select('id, project_id, person_id, organization_id, direction')
      .single();
    call = result.data;
    error = result.error;
  }

  // Fallback: match by call_session_id (WebRTC calls may have this)
  if (!call && payload.call_session_id) {
    console.log('[Recording Webhook] No match by call_control_id, trying call_session_id:', payload.call_session_id);
    const result = await supabase
      .from('calls')
      .update({
        recording_url: recordingUrl,
        recording_duration_seconds: durationSeconds,
      })
      .eq('telnyx_call_session_id', payload.call_session_id)
      .select('id, project_id, person_id, organization_id, direction')
      .single();
    call = result.data;
    error = result.error;
  }

  // Fallback: match by phone numbers and recent time window (last 30 min)
  if (!call && (payload.from || payload.to)) {
    console.log('[Recording Webhook] No match by session_id, trying phone number match');
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    // Strip sip: prefix and @domain suffix, then normalize
    const cleanNum = (num: string) => num.replace(/^sip:/, '').replace(/@.*$/, '');
    const fromNum = payload.from ? cleanNum(payload.from) : '';
    const toNum = payload.to ? cleanNum(payload.to) : '';
    // Also create versions without + and country code for matching
    const stripPlus = (num: string) => num.replace(/^\+/, '');
    const fromStripped = stripPlus(fromNum);
    const toStripped = stripPlus(toNum);

    console.log('[Recording Webhook] Phone match - from:', fromNum, 'to:', toNum, 'stripped from:', fromStripped, 'stripped to:', toStripped);

    // Build OR conditions for all number format variations
    const orConditions = [
      `from_number.eq.${fromNum}`,
      `to_number.eq.${toNum}`,
      `from_number.eq.${fromStripped}`,
      `to_number.eq.${toStripped}`,
    ].filter(c => !c.endsWith('.eq.')).join(',');

    const result = await supabase
      .from('calls')
      .update({
        recording_url: recordingUrl,
        recording_duration_seconds: durationSeconds,
      })
      .or(orConditions)
      .is('recording_url', null)
      .gte('started_at', thirtyMinAgo)
      .order('started_at', { ascending: false })
      .limit(1)
      .select('id, project_id, person_id, organization_id, direction')
      .single();
    call = result.data;
    error = result.error;
  }

  if (error || !call) {
    console.error('[Recording Webhook] Could not match recording to any call:', error?.message);
    return;
  }

  console.log('[Recording Webhook] Matched recording to call:', call.id);

  if (call) {
    emitAutomationEvent({
      projectId: call.project_id,
      triggerType: 'call.recording_saved' as 'call.completed',
      entityType: 'call',
      entityId: call.id,
      data: {
        call_id: call.id,
        recording_url: recordingUrl,
        person_id: call.person_id,
        organization_id: call.organization_id,
      },
    }).catch((err) => console.error('Error emitting recording automation event:', err));
  }
}

// ============================================================================
// SMS Webhook Event Processing
// ============================================================================

export interface TelnyxSmsWebhookPayload {
  id: string;
  record_type: string;
  direction: string;
  from: { phone_number: string; carrier?: string; line_type?: string };
  to: Array<{ phone_number: string; status: string; carrier?: string; line_type?: string }>;
  text: string;
  parts: number;
  messaging_profile_id: string;
  type: string;
  errors?: Array<{ code: string; title: string; detail?: string }>;
}

export interface TelnyxSmsWebhookEvent {
  data: {
    event_type: string;
    id: string;
    occurred_at: string;
    payload: TelnyxSmsWebhookPayload;
  };
  meta: {
    attempt: number;
    delivered_to: string;
  };
}

/**
 * Process SMS webhook events from Telnyx
 */
export async function processSmsEvent(event: TelnyxSmsWebhookEvent): Promise<void> {
  const eventType = event.data.event_type;
  const payload = event.data.payload;

  console.log(`[SMS Webhook] Processing event: ${eventType}`, { messageId: payload.id });

  switch (eventType) {
    case 'message.sent':
      await handleSmsSent(payload);
      break;
    case 'message.delivered':
      await handleSmsDelivered(payload);
      break;
    case 'message.failed':
      await handleSmsFailed(payload);
      break;
    case 'message.received':
      await handleSmsReceived(payload);
      break;
    case 'message.finalized':
      // Terminal state event - no action needed, the message status was already set
      // by a prior sent/delivered/failed event
      break;
    default:
      console.log(`[SMS Webhook] Unhandled event type: ${eventType}`);
  }
}

async function handleSmsSent(payload: TelnyxSmsWebhookPayload): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('sms_messages')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('telnyx_message_id', payload.id);

  if (error) {
    console.error('[SMS Webhook] Error updating SMS on sent:', error);
  }
}

async function handleSmsDelivered(payload: TelnyxSmsWebhookPayload): Promise<void> {
  const supabase = createAdminClient();

  const { data: sms, error } = await supabase
    .from('sms_messages')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
    })
    .eq('telnyx_message_id', payload.id)
    .select('id, project_id, person_id, organization_id')
    .single();

  if (error) {
    console.error('[SMS Webhook] Error updating SMS on delivered:', error);
    return;
  }

  if (sms) {
    emitAutomationEvent({
      projectId: sms.project_id,
      triggerType: 'sms.delivered',
      entityType: 'person',
      entityId: sms.person_id || sms.id,
      data: {
        sms_id: sms.id,
        person_id: sms.person_id,
        organization_id: sms.organization_id,
      },
    }).catch((err) => console.error('[SMS Webhook] Error emitting sms.delivered event:', err));
  }
}

async function handleSmsFailed(payload: TelnyxSmsWebhookPayload): Promise<void> {
  const supabase = createAdminClient();
  const errorInfo = payload.errors?.[0];

  const { data: sms, error } = await supabase
    .from('sms_messages')
    .update({
      status: 'failed',
      error_code: errorInfo?.code ?? null,
      error_message: errorInfo?.title ?? errorInfo?.detail ?? 'Unknown error',
    })
    .eq('telnyx_message_id', payload.id)
    .select('id, project_id, person_id, organization_id')
    .single();

  if (error) {
    console.error('[SMS Webhook] Error updating SMS on failed:', error);
    return;
  }

  if (sms) {
    emitAutomationEvent({
      projectId: sms.project_id,
      triggerType: 'sms.failed',
      entityType: 'person',
      entityId: sms.person_id || sms.id,
      data: {
        sms_id: sms.id,
        person_id: sms.person_id,
        error_code: errorInfo?.code,
        error_message: errorInfo?.title,
      },
    }).catch((err) => console.error('[SMS Webhook] Error emitting sms.failed event:', err));
  }
}

async function handleSmsReceived(payload: TelnyxSmsWebhookPayload): Promise<void> {
  const supabase = createAdminClient();
  const fromNumber = payload.from?.phone_number;
  const toNumber = payload.to?.[0]?.phone_number;

  if (!fromNumber || !toNumber) {
    console.error('[SMS Webhook] Missing from/to number in received event');
    return;
  }

  // Find Telnyx connection by the receiving phone number
  const { data: connection } = await supabase
    .from('telnyx_connections')
    .select('id, project_id, user_id')
    .eq('phone_number', toNumber)
    .eq('status', 'active')
    .single();

  if (!connection) {
    console.log('[SMS Webhook] No connection found for number:', toNumber);
    return;
  }

  // For user-level connections (project_id is null), search across all the user's projects
  // to find a matching person by phone number
  let projectId = connection.project_id;
  let person: { id: string; organization_id: string | null } | null = null;

  if (!projectId && connection.user_id) {
    // Get all projects this user is a member of
    const { data: memberships } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', connection.user_id);

    if (memberships && memberships.length > 0) {
      // Search across all user's projects to find a matching person
      for (const membership of memberships) {
        person = await matchInboundPhoneToPerson(supabase, membership.project_id, fromNumber);
        if (person) {
          projectId = membership.project_id;
          break;
        }
      }

      // If no person matched, default to the first project
      if (!projectId) {
        projectId = memberships[0].project_id;
      }
    }
  } else if (projectId) {
    // Project-level connection - just match within that project
    person = await matchInboundPhoneToPerson(supabase, projectId, fromNumber);
  }

  if (!projectId) {
    console.log('[SMS Webhook] No project found for connection:', connection.id);
    return;
  }

  // Create inbound SMS record
  const { data: sms, error } = await supabase
    .from('sms_messages')
    .insert({
      project_id: projectId,
      telnyx_connection_id: connection.id,
      telnyx_message_id: payload.id,
      direction: 'inbound',
      status: 'received',
      from_number: fromNumber,
      to_number: toNumber,
      body: payload.text,
      segments: payload.parts,
      person_id: person?.id ?? null,
      organization_id: person?.organization_id ?? null,
      received_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    console.error('[SMS Webhook] Error creating inbound SMS record:', error);
    return;
  }

  if (sms) {
    // Create activity log entry
    await createSmsActivityFromWebhook(supabase, sms);

    // Emit automation event
    emitAutomationEvent({
      projectId: projectId,
      triggerType: 'sms.received',
      entityType: 'person',
      entityId: person?.id || sms.id,
      data: {
        sms_id: sms.id,
        from_number: fromNumber,
        body: payload.text,
        person_id: person?.id,
        organization_id: person?.organization_id,
      },
    }).catch((err) => console.error('[SMS Webhook] Error emitting sms.received event:', err));
  }
}

// Helper to match inbound phone to person
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function matchInboundPhoneToPerson(
  supabase: ReturnType<typeof createAdminClient>,
  projectId: string,
  phoneNumber: string
): Promise<{ id: string; organization_id: string | null } | null> {
  // Normalize the phone number
  const strippedPhone = phoneNumber.replace(/\D/g, '');
  const withPlus = phoneNumber.startsWith('+') ? phoneNumber : `+${strippedPhone}`;

  const { data: person } = await supabase
    .from('people')
    .select('id, organization_id')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .or(
      `phone.eq.${phoneNumber},mobile_phone.eq.${phoneNumber},` +
        `phone.eq.${strippedPhone},mobile_phone.eq.${strippedPhone},` +
        `phone.eq.${withPlus},mobile_phone.eq.${withPlus}`
    )
    .limit(1)
    .single();

  return person ?? null;
}

// Create activity from inbound SMS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createSmsActivityFromWebhook(
  supabase: ReturnType<typeof createAdminClient>,
  sms: any
): Promise<void> {
  try {
    const directionLabel = sms.direction === 'outbound' ? 'Outbound' : 'Inbound';
    const phoneNumber = sms.direction === 'outbound' ? sms.to_number : sms.from_number;

    await supabase.from('activity_log').insert({
      project_id: sms.project_id,
      user_id: sms.user_id,
      entity_type: 'person',
      entity_id: sms.person_id || sms.id,
      action: sms.direction === 'outbound' ? 'sent' : 'received',
      activity_type: 'sms',
      outcome: sms.direction === 'outbound' ? 'sms_sent' : 'sms_received',
      person_id: sms.person_id,
      organization_id: sms.organization_id,
      direction: sms.direction,
      subject: `${directionLabel} SMS ${sms.direction === 'outbound' ? 'to' : 'from'} ${phoneNumber}`,
      notes: sms.body?.substring(0, 500),
      metadata: {
        sms_id: sms.id,
        full_body: sms.body,
        phone_number: phoneNumber,
      },
    });
  } catch (err) {
    console.error('[SMS Webhook] Error creating SMS activity:', err);
  }
}

// ============================================================================
// Call Activity Creation
// ============================================================================

// Create an activity_log entry from a completed call
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createActivityFromCall(supabase: any, call: any): Promise<void> {
  try {
    const directionLabel = call.direction === 'outbound' ? 'Outbound' : 'Inbound';
    const durationMinutes = call.talk_time_seconds
      ? Math.ceil(call.talk_time_seconds / 60)
      : 0;

    // Map disposition to activity outcome
    const outcome = call.disposition
      ? DISPOSITION_TO_ACTIVITY_OUTCOME[call.disposition as CallDisposition] ?? 'other'
      : call.status === 'no_answer'
        ? 'call_no_answer'
        : null;

    await supabase.from('activity_log').insert({
      project_id: call.project_id,
      user_id: call.user_id,
      entity_type: 'person',
      entity_id: call.person_id,
      action: 'logged',
      activity_type: 'call',
      person_id: call.person_id,
      organization_id: call.organization_id,
      opportunity_id: call.opportunity_id,
      direction: call.direction,
      duration_minutes: durationMinutes,
      outcome,
      subject: `${directionLabel} call to ${call.to_number}`,
      notes: call.disposition_notes,
      metadata: {
        call_id: call.id,
        recording_url: call.recording_url,
        talk_time_seconds: call.talk_time_seconds,
        status: call.status,
      },
    });
  } catch (err) {
    console.error('Error creating activity from call:', err);
  }
}

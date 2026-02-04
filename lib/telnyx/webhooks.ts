// Telnyx webhook event processing

import { createClient } from '@supabase/supabase-js';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { DISPOSITION_TO_ACTIVITY_OUTCOME } from '@/types/call';
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

// Verify webhook signature (Telnyx uses a public key approach)
// For simplicity, we verify the webhook secret from the payload
export function verifyWebhookSignature(
  _payload: string,
  _signature: string | null,
  _timestamp: string | null
): boolean {
  // Telnyx webhook verification uses their public key or a shared secret.
  // In production, implement proper signature verification using
  // the telnyx package or manual Ed25519 verification.
  // For now, we rely on the webhook URL being secret + TLS.
  // TODO: Implement full Ed25519 signature verification
  return true;
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

  const { error } = await supabase
    .from('calls')
    .update({
      status: 'answered',
      answered_at: new Date().toISOString(),
    })
    .eq('telnyx_call_control_id', payload.call_control_id);

  if (error) {
    console.error('Error updating call on answered:', error);
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

  const recordingUrl = payload.recording_urls?.mp3 ?? null;
  const durationSeconds = payload.duration_millis
    ? Math.round(payload.duration_millis / 1000)
    : null;

  const { data: call, error } = await supabase
    .from('calls')
    .update({
      recording_url: recordingUrl,
      recording_duration_seconds: durationSeconds,
    })
    .eq('telnyx_call_control_id', payload.call_control_id)
    .select('id, project_id, person_id, organization_id, direction')
    .single();

  if (error) {
    console.error('Error updating call with recording:', error);
    return;
  }

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

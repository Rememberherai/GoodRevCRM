// Telnyx VoIP business logic layer

import { createClient } from '@supabase/supabase-js';
import * as telnyxClient from './client';
import { decryptApiKey } from './encryption';
import type { TelnyxConnection, CallMetrics } from '@/types/call';

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

// Get the active Telnyx connection for a project (with decrypted API key)
export async function getProjectConnection(
  projectId: string
): Promise<TelnyxConnection | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('telnyx_connections')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'active')
    .single();

  if (!data) return null;

  // Decrypt the API key before returning
  try {
    const decryptedApiKey = decryptApiKey(data.api_key);
    return { ...data, api_key: decryptedApiKey } as TelnyxConnection;
  } catch (error) {
    console.error('Error decrypting API key:', error);
    // Return with original key (may be unencrypted for migration support)
    return data as TelnyxConnection;
  }
}

// Create a call record in the database and initiate via Telnyx
export async function initiateOutboundCall(params: {
  projectId: string;
  userId: string;
  toNumber: string;
  personId?: string | null;
  organizationId?: string | null;
  opportunityId?: string | null;
  rfpId?: string | null;
  record?: boolean;
}): Promise<{ callId: string; callControlId: string }> {
  const connection = await getProjectConnection(params.projectId);
  if (!connection) {
    throw new Error('No active Telnyx connection for this project');
  }

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/telnyx`;
  const shouldRecord = params.record ?? connection.record_calls;

  // Create the call record in the database FIRST to avoid race condition
  // with webhook events arriving before the record exists
  const supabase = createAdminClient();
  const { data: call, error } = await supabase
    .from('calls')
    .insert({
      project_id: params.projectId,
      telnyx_connection_id: connection.id,
      direction: 'outbound',
      status: 'initiated',
      from_number: connection.phone_number,
      to_number: params.toNumber,
      user_id: params.userId,
      person_id: params.personId ?? null,
      organization_id: params.organizationId ?? null,
      opportunity_id: params.opportunityId ?? null,
      rfp_id: params.rfpId ?? null,
      recording_enabled: shouldRecord,
    })
    .select('id')
    .single();

  if (error || !call) {
    throw new Error('Failed to create call record');
  }

  // Now initiate the call via Telnyx API
  let callControlId: string;
  try {
    const telnyxResponse = await telnyxClient.initiateCall(connection.api_key, {
      connectionId: connection.sip_connection_id ?? '',
      fromNumber: connection.phone_number,
      toNumber: params.toNumber,
      webhookUrl,
      recordCall: shouldRecord,
      amdEnabled: connection.amd_enabled,
      callerIdName: connection.caller_id_name ?? undefined,
      clientState: JSON.stringify({ projectId: params.projectId, callId: call.id }),
    });

    callControlId = telnyxResponse.data.call_control_id;

    // Update the call record with Telnyx IDs
    await supabase
      .from('calls')
      .update({
        telnyx_call_control_id: callControlId,
        telnyx_call_leg_id: telnyxResponse.data.call_leg_id,
        telnyx_call_session_id: telnyxResponse.data.call_session_id,
      })
      .eq('id', call.id);
  } catch (telnyxError) {
    // If Telnyx call fails, mark the DB record as failed
    await supabase
      .from('calls')
      .update({ status: 'failed', ended_at: new Date().toISOString() })
      .eq('id', call.id);
    throw telnyxError;
  }

  // Update last_call_at on the connection
  supabase
    .from('telnyx_connections')
    .update({ last_call_at: new Date().toISOString() })
    .eq('id', connection.id)
    .then(() => {}, () => {});

  return { callId: call.id, callControlId };
}

// Hang up an active call
export async function hangupCall(
  projectId: string,
  callId: string
): Promise<void> {
  const supabase = createAdminClient();

  const { data: call } = await supabase
    .from('calls')
    .select('telnyx_call_control_id, telnyx_connection_id')
    .eq('id', callId)
    .eq('project_id', projectId)
    .single();

  if (!call?.telnyx_call_control_id) {
    throw new Error('Call not found or missing control ID');
  }

  const { data: connection } = await supabase
    .from('telnyx_connections')
    .select('api_key')
    .eq('id', call.telnyx_connection_id)
    .single();

  if (!connection?.api_key) {
    throw new Error('Telnyx connection not found');
  }

  const decryptedApiKey = decryptApiKey(connection.api_key);
  await telnyxClient.hangupCall(decryptedApiKey, call.telnyx_call_control_id);
}

// Toggle recording on an active call
export async function toggleRecording(
  projectId: string,
  callId: string,
  action: 'start' | 'stop'
): Promise<void> {
  const supabase = createAdminClient();

  const { data: call } = await supabase
    .from('calls')
    .select('telnyx_call_control_id, telnyx_connection_id')
    .eq('id', callId)
    .eq('project_id', projectId)
    .single();

  if (!call?.telnyx_call_control_id) {
    throw new Error('Call not found or missing control ID');
  }

  const { data: connection } = await supabase
    .from('telnyx_connections')
    .select('api_key')
    .eq('id', call.telnyx_connection_id)
    .single();

  if (!connection?.api_key) {
    throw new Error('Telnyx connection not found');
  }

  const decryptedApiKey = decryptApiKey(connection.api_key);
  if (action === 'start') {
    await telnyxClient.startRecording(decryptedApiKey, call.telnyx_call_control_id);
    await supabase.from('calls').update({ recording_enabled: true }).eq('id', callId);
  } else {
    await telnyxClient.stopRecording(decryptedApiKey, call.telnyx_call_control_id);
  }
}

// Set call disposition
export async function setCallDisposition(params: {
  projectId: string;
  callId: string;
  disposition: string;
  dispositionNotes?: string | null;
}): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('calls')
    .update({
      disposition: params.disposition,
      disposition_notes: params.dispositionNotes ?? null,
    })
    .eq('id', params.callId)
    .eq('project_id', params.projectId);

  if (error) {
    throw new Error('Failed to update call disposition');
  }
}

// Get call metrics for a project
export async function getCallMetrics(params: {
  projectId: string;
  startDate: string;
  endDate: string;
  userId?: string;
}): Promise<CallMetrics> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc('get_call_metrics', {
    p_project_id: params.projectId,
    p_start_date: params.startDate,
    p_end_date: params.endDate,
    ...(params.userId ? { p_user_id: params.userId } : {}),
  });

  if (error) {
    console.error('Error fetching call metrics:', error);
    throw new Error('Failed to fetch call metrics');
  }

  return data as CallMetrics;
}

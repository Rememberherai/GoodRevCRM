// Telnyx SMS business logic layer

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as smsClient from './sms';
import { getUserConnection } from './service';
import { emitAutomationEvent } from '@/lib/automations/engine';

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

export interface SendSmsInput {
  projectId: string;
  userId: string;
  toNumber: string;
  body: string;
  personId?: string | null;
  organizationId?: string | null;
  opportunityId?: string | null;
  rfpId?: string | null;
  sequenceEnrollmentId?: string | null;
  sequenceStepId?: string | null;
}

export interface SmsResult {
  smsId: string;
  telnyxMessageId: string;
}

/**
 * Send an outbound SMS message
 */
export async function sendOutboundSms(input: SendSmsInput): Promise<SmsResult> {
  const connection = await getUserConnection(input.userId);
  if (!connection) {
    throw new Error('No active Telnyx connection for this user. Configure it in Settings → Phone.');
  }

  if (!connection.messaging_profile_id) {
    throw new Error('No messaging profile configured. Add it in Settings → Phone.');
  }

  const supabase = createAdminClient();
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/telnyx`;

  // Normalize the phone number
  const normalizedTo = smsClient.normalizePhoneNumber(input.toNumber);

  // Create the SMS record first (avoid race condition with webhook)
  const { data: sms, error } = await supabase
    .from('sms_messages')
    .insert({
      project_id: input.projectId,
      telnyx_connection_id: connection.id,
      direction: 'outbound',
      status: 'queued',
      from_number: connection.phone_number,
      to_number: normalizedTo,
      body: input.body,
      user_id: input.userId,
      person_id: input.personId ?? null,
      organization_id: input.organizationId ?? null,
      opportunity_id: input.opportunityId ?? null,
      rfp_id: input.rfpId ?? null,
      sequence_enrollment_id: input.sequenceEnrollmentId ?? null,
      sequence_step_id: input.sequenceStepId ?? null,
    })
    .select('id')
    .single();

  if (error || !sms) {
    console.error('Error creating SMS record:', error);
    throw new Error('Failed to create SMS record');
  }

  // Send via Telnyx API
  try {
    const response = await smsClient.sendSms(connection.api_key, {
      from: connection.phone_number,
      to: normalizedTo,
      body: input.body,
      messagingProfileId: connection.messaging_profile_id,
      webhookUrl,
    });

    // Update record with Telnyx ID and status
    await supabase
      .from('sms_messages')
      .update({
        telnyx_message_id: response.data.id,
        status: 'sending',
        segments: response.data.parts,
        sent_at: new Date().toISOString(),
      })
      .eq('id', sms.id);

    // Log activity
    await createSmsActivity(supabase, {
      id: sms.id,
      project_id: input.projectId,
      user_id: input.userId,
      direction: 'outbound',
      to_number: normalizedTo,
      from_number: connection.phone_number,
      body: input.body,
      person_id: input.personId ?? null,
      organization_id: input.organizationId ?? null,
    });

    // Emit automation event (fire-and-forget)
    emitAutomationEvent({
      projectId: input.projectId,
      triggerType: 'sms.sent',
      entityType: 'person',
      entityId: input.personId || sms.id,
      data: {
        sms_id: sms.id,
        to_number: normalizedTo,
        body: input.body,
        person_id: input.personId,
        organization_id: input.organizationId,
      },
    }).catch((err) => console.error('Error emitting sms.sent automation event:', err));

    return { smsId: sms.id, telnyxMessageId: response.data.id };
  } catch (telnyxError) {
    // Mark as failed
    await supabase
      .from('sms_messages')
      .update({
        status: 'failed',
        error_message: telnyxError instanceof Error ? telnyxError.message : 'Unknown error',
      })
      .eq('id', sms.id);
    throw telnyxError;
  }
}

/**
 * Create activity log entry for SMS
 */
export async function createSmsActivity(
  supabase: SupabaseClient,
  sms: {
    id: string;
    project_id: string;
    user_id: string | null;
    direction: string;
    to_number: string;
    from_number: string;
    body: string;
    person_id: string | null;
    organization_id: string | null;
  }
): Promise<void> {
  try {
    const directionLabel = sms.direction === 'outbound' ? 'Outbound' : 'Inbound';
    const phoneNumber = sms.direction === 'outbound' ? sms.to_number : sms.from_number;

    await supabase.from('activity_log').insert({
      project_id: sms.project_id,
      user_id: sms.user_id,
      entity_type: 'person',
      entity_id: sms.person_id || sms.id, // Use SMS ID if no person linked
      action: sms.direction === 'outbound' ? 'sent' : 'received',
      activity_type: 'sms',
      outcome: sms.direction === 'outbound' ? 'sms_sent' : 'sms_received',
      person_id: sms.person_id,
      organization_id: sms.organization_id,
      direction: sms.direction,
      subject: `${directionLabel} SMS ${sms.direction === 'outbound' ? 'to' : 'from'} ${phoneNumber}`,
      notes: sms.body.substring(0, 500),
      metadata: {
        sms_id: sms.id,
        full_body: sms.body,
        phone_number: phoneNumber,
      },
    });
  } catch (err) {
    console.error('Error creating SMS activity:', err);
  }
}

/**
 * Match an inbound phone number to a person in a project
 */
export async function matchPhoneToPerson(
  supabase: SupabaseClient,
  projectId: string,
  phoneNumber: string
): Promise<{ id: string; organization_id: string | null } | null> {
  // Try various formats of the phone number
  const normalizedPhone = smsClient.normalizePhoneNumber(phoneNumber);
  const strippedPhone = phoneNumber.replace(/\D/g, '');

  const { data: person } = await supabase
    .from('people')
    .select('id, organization_id')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .or(
      `phone.eq.${normalizedPhone},mobile_phone.eq.${normalizedPhone},` +
        `phone.eq.${strippedPhone},mobile_phone.eq.${strippedPhone},` +
        `phone.eq.${phoneNumber},mobile_phone.eq.${phoneNumber}`
    )
    .limit(1)
    .single();

  return person ?? null;
}

/**
 * Get SMS conversation for a person
 */
export async function getPersonSmsConversation(
  projectId: string,
  personId: string,
  limit = 100
): Promise<
  Array<{
    id: string;
    direction: string;
    status: string;
    body: string;
    from_number: string;
    to_number: string;
    created_at: string;
    delivered_at: string | null;
    user?: { id: string; full_name: string | null };
  }>
> {
  const supabase = createAdminClient();

  const { data: messages } = await supabase
    .from('sms_messages')
    .select(
      `
      id,
      direction,
      status,
      body,
      from_number,
      to_number,
      created_at,
      delivered_at,
      user:users(id, full_name)
    `
    )
    .eq('project_id', projectId)
    .eq('person_id', personId)
    .order('created_at', { ascending: true })
    .limit(limit);

  // Map the Supabase response (relations come as arrays) to expected shape
  return (messages ?? []).map((msg) => ({
    ...msg,
    user: Array.isArray(msg.user) ? msg.user[0] : msg.user,
  })) as Array<{
    id: string;
    direction: string;
    status: string;
    body: string;
    from_number: string;
    to_number: string;
    created_at: string;
    delivered_at: string | null;
    user?: { id: string; full_name: string | null };
  }>;
}

/**
 * Get SMS conversation for an organization
 */
export async function getOrganizationSmsConversation(
  projectId: string,
  organizationId: string,
  limit = 100
): Promise<
  Array<{
    id: string;
    direction: string;
    status: string;
    body: string;
    from_number: string;
    to_number: string;
    created_at: string;
    delivered_at: string | null;
    person?: { id: string; first_name: string; last_name: string } | null;
    user?: { id: string; full_name: string | null };
  }>
> {
  const supabase = createAdminClient();

  const { data: messages } = await supabase
    .from('sms_messages')
    .select(
      `
      id,
      direction,
      status,
      body,
      from_number,
      to_number,
      created_at,
      delivered_at,
      person:people(id, first_name, last_name),
      user:users(id, full_name)
    `
    )
    .eq('project_id', projectId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })
    .limit(limit);

  // Map the Supabase response (relations come as arrays) to expected shape
  return (messages ?? []).map((msg) => ({
    ...msg,
    person: Array.isArray(msg.person) ? msg.person[0] : msg.person,
    user: Array.isArray(msg.user) ? msg.user[0] : msg.user,
  })) as Array<{
    id: string;
    direction: string;
    status: string;
    body: string;
    from_number: string;
    to_number: string;
    created_at: string;
    delivered_at: string | null;
    person?: { id: string; first_name: string; last_name: string } | null;
    user?: { id: string; full_name: string | null };
  }>;
}

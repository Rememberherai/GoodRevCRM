/**
 * Email send provider abstraction.
 * Dispatches to Gmail or Resend based on the configured provider.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/gmail/service';
import { sendViaResend } from '@/lib/email/resend';
import { decrypt } from '@/lib/encryption';
import type { Database } from '@/types/database';
import type { GmailConnection } from '@/types/gmail';

type EmailSendConfigRow = Database['public']['Tables']['email_send_configs']['Row'];

export interface ProviderEmailPayload {
  to: string;
  subject: string;
  body_html: string;
  body_text?: string;
  reply_to?: string;
  person_id?: string;
}

export interface ProviderSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email using the specified send config.
 * Dispatches to Gmail or Resend based on config.provider.
 */
export async function sendViaProvider(
  config: EmailSendConfigRow,
  payload: ProviderEmailPayload,
  actorUserId: string,
  projectId: string
): Promise<ProviderSendResult> {
  if (config.provider === 'resend') {
    return sendViaResendProvider(config, payload);
  }

  return sendViaGmailProvider(config, payload, actorUserId, projectId);
}

async function sendViaResendProvider(
  config: EmailSendConfigRow,
  payload: ProviderEmailPayload
): Promise<ProviderSendResult> {
  if (config.domain_verified !== true) {
    return { success: false, error: 'Resend domain is not verified' };
  }

  if (!config.resend_api_key_encrypted) {
    return { success: false, error: 'Resend API key not configured' };
  }

  let apiKey: string;
  try {
    apiKey = decrypt(config.resend_api_key_encrypted);
  } catch {
    return { success: false, error: 'Failed to decrypt Resend API key' };
  }

  const fromAddress = config.from_name
    ? `${config.from_name} <${config.from_email}>`
    : config.from_email ?? '';

  if (!fromAddress) {
    return { success: false, error: 'Resend from_email not configured' };
  }

  return sendViaResend(apiKey, {
    from: fromAddress,
    to: payload.to,
    subject: payload.subject,
    html: payload.body_html,
    text: payload.body_text,
    reply_to: payload.reply_to,
  });
}

async function sendViaGmailProvider(
  config: EmailSendConfigRow,
  payload: ProviderEmailPayload,
  actorUserId: string,
  projectId: string
): Promise<ProviderSendResult> {
  if (!config.gmail_connection_id) {
    return { success: false, error: 'Gmail connection not linked to send config' };
  }

  const admin = createAdminClient();
  const { data: gmailConn } = await admin
    .from('gmail_connections')
    .select('*')
    .eq('id', config.gmail_connection_id)
    .eq('project_id', projectId)
    .eq('status', 'connected')
    .maybeSingle();

  if (!gmailConn) {
    return { success: false, error: 'Gmail connection not found or inactive' };
  }

  try {
    const result = await sendEmail(
      gmailConn as unknown as GmailConnection,
      {
        to: payload.to,
        subject: payload.subject,
        body_html: payload.body_html,
        body_text: payload.body_text,
        person_id: payload.person_id,
      },
      actorUserId,
      projectId
    );
    return { success: true, messageId: result.message_id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gmail send failed',
    };
  }
}

/**
 * Look up the email send config for a broadcast.
 * Priority: broadcast.send_config_id → project default → null (fallback to legacy Gmail).
 */
export async function resolveEmailSendConfig(
  projectId: string,
  sendConfigId?: string | null
): Promise<EmailSendConfigRow | null> {
  const admin = createAdminClient();

  // If a specific config is requested, use it
  if (sendConfigId) {
    const { data } = await admin
      .from('email_send_configs')
      .select('*')
      .eq('id', sendConfigId)
      .eq('project_id', projectId)
      .maybeSingle();
    return data;
  }

  // Otherwise, look for the project default
  const { data } = await admin
    .from('email_send_configs')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_default', true)
    .maybeSingle();
  if (data?.provider === 'resend' && data.domain_verified !== true) {
    return null;
  }
  return data;
}

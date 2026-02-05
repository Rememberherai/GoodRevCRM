import { refreshAccessToken, isTokenExpired } from './oauth';
import type { SendEmailInput, SendEmailResult, GmailConnection } from '@/types/gmail';
import { createClient } from '@supabase/supabase-js';

export const GMAIL_API_URL = 'https://gmail.googleapis.com/gmail/v1/users/me';

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n\x00]/g, '');
}

export class GmailServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'GmailServiceError';
  }
}

// Create admin client for service operations
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new GmailServiceError('Missing Supabase credentials');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Get a valid access token, refreshing if needed
 */
export async function getValidAccessToken(connection: GmailConnection): Promise<string> {
  if (!isTokenExpired(connection.token_expires_at)) {
    return connection.access_token;
  }

  // Token is expired, refresh it
  const supabase = createAdminClient();

  try {
    const tokens = await refreshAccessToken(connection.refresh_token);

    // Update connection with new tokens
    await supabase
      .from('gmail_connections')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        status: 'connected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    return tokens.access_token;
  } catch (error) {
    // Mark connection as expired/error
    await supabase
      .from('gmail_connections')
      .update({
        status: 'expired',
        error_message: error instanceof Error ? error.message : 'Token refresh failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    throw new GmailServiceError('Failed to refresh access token', 'token_refresh_failed');
  }
}

/**
 * Create MIME message for sending
 */
function createMimeMessage(input: SendEmailInput, fromEmail: string, trackingId: string): string {
  const to = sanitizeHeaderValue(Array.isArray(input.to) ? input.to.join(', ') : input.to);
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;

  // Inject tracking pixel into HTML body
  const trackingPixelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/track/open?tid=${trackingId}`;
  const trackedHtml = injectTrackingPixel(input.body_html, trackingPixelUrl);

  // Wrap links with click tracking
  const finalHtml = wrapLinksWithTracking(trackedHtml, trackingId);

  let message = [
    'MIME-Version: 1.0',
    `From: ${fromEmail}`,
    `To: ${to}`,
  ];

  if (input.cc?.length) {
    message.push(`Cc: ${sanitizeHeaderValue(input.cc.join(', '))}`);
  }
  if (input.bcc?.length) {
    message.push(`Bcc: ${sanitizeHeaderValue(input.bcc.join(', '))}`);
  }

  message.push(`Subject: ${encodeSubject(input.subject)}`);

  if (input.reply_to_message_id) {
    const sanitizedReplyId = sanitizeHeaderValue(input.reply_to_message_id);
    message.push(`In-Reply-To: ${sanitizedReplyId}`);
    message.push(`References: ${sanitizedReplyId}`);
  }

  message.push(
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    input.body_text ?? stripHtml(input.body_html),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    finalHtml,
    '',
    `--${boundary}--`
  );

  return message.join('\r\n');
}

/**
 * Encode subject for non-ASCII characters
 */
function encodeSubject(subject: string): string {
  const sanitized = sanitizeHeaderValue(subject);
  // Check if subject contains non-ASCII characters
  if (!/^[\x00-\x7F]*$/.test(sanitized)) {
    // Use UTF-8 encoding with base64
    return `=?UTF-8?B?${Buffer.from(sanitized).toString('base64')}?=`;
  }
  return sanitized;
}

/**
 * Strip HTML tags for plain text version
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Inject tracking pixel into HTML body
 */
function injectTrackingPixel(html: string, pixelUrl: string): string {
  const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;

  // Try to inject before </body>
  if (html.includes('</body>')) {
    return html.replace('</body>', `${pixel}</body>`);
  }

  // Otherwise append at the end
  return html + pixel;
}

/**
 * Wrap links with click tracking
 */
function wrapLinksWithTracking(html: string, trackingId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  return html.replace(
    /<a\s+([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi,
    (match, before, url, after) => {
      // Skip tracking for certain URLs
      if (
        url.startsWith('mailto:') ||
        url.startsWith('tel:') ||
        url.startsWith('#') ||
        (baseUrl && url.startsWith(baseUrl)) // Don't track our own URLs
      ) {
        return match;
      }

      const trackedUrl = `${baseUrl}/api/track/click?tid=${trackingId}&url=${encodeURIComponent(url)}`;
      return `<a ${before}href="${trackedUrl}"${after}>`;
    }
  );
}

/**
 * Send an email via Gmail API
 */
export async function sendEmail(
  connection: GmailConnection,
  input: SendEmailInput,
  userId: string,
  projectId?: string | null
): Promise<SendEmailResult> {
  console.log('[GMAIL_SERVICE] ====== START sendEmail() ======');
  console.log('[GMAIL_SERVICE] connection.id:', connection.id, 'connection.email:', connection.email);
  console.log('[GMAIL_SERVICE] userId:', userId, 'projectId:', projectId);
  console.log('[GMAIL_SERVICE] input.to:', input.to, 'input.subject:', input.subject);
  console.log('[GMAIL_SERVICE] input.person_id:', input.person_id, 'input.organization_id:', input.organization_id);

  const supabase = createAdminClient();
  console.log('[GMAIL_SERVICE] admin client created');

  // Generate tracking ID
  const trackingId = crypto.randomUUID();
  console.log('[GMAIL_SERVICE] trackingId:', trackingId);

  // Get valid access token
  console.log('[GMAIL_SERVICE] getting valid access token...');
  const accessToken = await getValidAccessToken(connection);
  console.log('[GMAIL_SERVICE] access token obtained, length:', accessToken.length);

  // Create MIME message
  console.log('[GMAIL_SERVICE] creating MIME message...');
  const mimeMessage = createMimeMessage(input, connection.email, trackingId);
  console.log('[GMAIL_SERVICE] MIME message created, length:', mimeMessage.length);

  // Base64url encode the message
  const encodedMessage = Buffer.from(mimeMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Build request body
  const requestBody: { raw: string; threadId?: string } = { raw: encodedMessage };
  if (input.thread_id) {
    requestBody.threadId = input.thread_id;
    console.log('[GMAIL_SERVICE] replying to thread:', input.thread_id);
  }

  // Send via Gmail API
  console.log('[GMAIL_SERVICE] sending via Gmail API...');
  const response = await fetch(`${GMAIL_API_URL}/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });
  console.log('[GMAIL_SERVICE] Gmail API response status:', response.status, response.statusText);

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[GMAIL_SERVICE] ERROR: Gmail API failed:', response.status, errorBody.substring(0, 500));
    throw new GmailServiceError(
      `Failed to send email: ${response.statusText}`,
      'send_failed',
      response.status
    );
  }

  const result = await response.json();
  console.log('[GMAIL_SERVICE] Gmail API success — message_id:', result.id, 'threadId:', result.threadId);

  // Store sent email record
  const recipientEmail = Array.isArray(input.to) ? input.to[0] : input.to;
  console.log('[GMAIL_SERVICE] inserting into sent_emails table...');

  const { data: sentEmail, error: insertError } = await supabase
    .from('sent_emails')
    .insert({
      project_id: projectId ?? null,
      gmail_connection_id: connection.id,
      person_id: input.person_id ?? null,
      organization_id: input.organization_id ?? null,
      opportunity_id: input.opportunity_id ?? null,
      rfp_id: input.rfp_id ?? null,
      thread_id: result.threadId,
      message_id: result.id,
      recipient_email: recipientEmail,
      subject: input.subject,
      body_html: input.body_html,
      body_text: input.body_text ?? stripHtml(input.body_html),
      tracking_id: trackingId,
      sent_at: new Date().toISOString(),
      created_by: userId,
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[GMAIL_SERVICE] ERROR: sent_emails insert failed:', insertError.message, insertError.code, insertError.details);
  } else {
    console.log('[GMAIL_SERVICE] sent_emails insert SUCCESS, id:', sentEmail?.id);
  }

  // Also insert into the unified emails table so the email appears in the Emails tab immediately
  // (instead of waiting for Gmail sync to pick it up)
  const toEmails = Array.isArray(input.to) ? input.to : [input.to];
  console.log('[GMAIL_SERVICE] upserting into emails table...');
  const emailsPayload = {
    gmail_connection_id: connection.id,
    user_id: userId,
    gmail_message_id: result.id,
    gmail_thread_id: result.threadId,
    direction: 'outbound',
    from_email: connection.email,
    from_name: null,
    to_emails: toEmails,
    cc_emails: input.cc ?? [],
    bcc_emails: input.bcc ?? [],
    subject: input.subject,
    snippet: stripHtml(input.body_html).slice(0, 200),
    body_html: input.body_html,
    body_text: input.body_text ?? stripHtml(input.body_html),
    email_date: new Date().toISOString(),
    label_ids: ['SENT'],
    person_id: input.person_id ?? null,
    organization_id: input.organization_id ?? null,
    opportunity_id: input.opportunity_id ?? null,
    rfp_id: input.rfp_id ?? null,
    project_id: projectId ?? null,
    sent_email_id: sentEmail?.id ?? null,
  };
  console.log('[GMAIL_SERVICE] emails upsert payload keys:', Object.keys(emailsPayload));
  const { data: emailsData, error: emailsInsertError } = await supabase
    .from('emails')
    .upsert(emailsPayload, {
      onConflict: 'gmail_connection_id,gmail_message_id',
      ignoreDuplicates: true,
    })
    .select('id');

  if (emailsInsertError) {
    console.error('[GMAIL_SERVICE] ERROR: emails upsert failed:', emailsInsertError.message, emailsInsertError.code, emailsInsertError.details);
  } else {
    console.log('[GMAIL_SERVICE] emails upsert SUCCESS, data:', JSON.stringify(emailsData));
  }

  const finalResult = {
    message_id: result.id,
    thread_id: result.threadId,
    tracking_id: trackingId,
    sent_email_id: sentEmail?.id ?? null,
  };
  console.log('[GMAIL_SERVICE] ====== END sendEmail(), returning:', JSON.stringify(finalResult), '======');
  return finalResult;
}

/**
 * Get email thread history
 */
export async function getThreadHistory(
  connection: GmailConnection,
  threadId: string
): Promise<unknown[]> {
  const accessToken = await getValidAccessToken(connection);

  if (!/^[a-zA-Z0-9]+$/.test(threadId)) {
    throw new GmailServiceError('Invalid thread ID format', 'invalid_thread_id');
  }

  const response = await fetch(`${GMAIL_API_URL}/threads/${threadId}?format=full`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new GmailServiceError(
      'Failed to fetch thread',
      'thread_fetch_failed',
      response.status
    );
  }

  const thread = await response.json();
  return thread.messages ?? [];
}

/**
 * Check for new replies to tracked emails
 */
export async function checkForReplies(
  connection: GmailConnection,
  threadId: string,
  afterMessageId: string
): Promise<boolean> {
  const messages = await getThreadHistory(connection, threadId);

  // Check if there are messages after our sent message
  let foundOurMessage = false;
  for (const message of messages as { id: string }[]) {
    if (message.id === afterMessageId) {
      foundOurMessage = true;
      continue;
    }
    if (foundOurMessage) {
      // Found a message after ours - this is a reply
      return true;
    }
  }

  return false;
}

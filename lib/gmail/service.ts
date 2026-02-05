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
  const supabase = createAdminClient();

  // Generate tracking ID
  const trackingId = crypto.randomUUID();

  // Get valid access token
  const accessToken = await getValidAccessToken(connection);

  // Create MIME message
  const mimeMessage = createMimeMessage(input, connection.email, trackingId);

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
  }

  // Send via Gmail API
  const response = await fetch(`${GMAIL_API_URL}/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Gmail API error:', response.status, errorBody.substring(0, 200));
    throw new GmailServiceError(
      `Failed to send email: ${response.statusText}`,
      'send_failed',
      response.status
    );
  }

  const result = await response.json();

  // Store sent email record
  const recipientEmail = Array.isArray(input.to) ? input.to[0] : input.to;

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
    console.error('Error storing sent email:', insertError);
    // Don't throw - email was sent successfully
  }

  return {
    message_id: result.id,
    thread_id: result.threadId,
    tracking_id: trackingId,
    sent_email_id: sentEmail?.id ?? null,
  };
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

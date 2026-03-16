import { NextResponse } from 'next/server';
import {
  getValidAccessToken,
  GMAIL_API_URL,
  createAdminClient,
} from '@/lib/gmail/service';
import type { GmailConnection, GmailMessage, GmailMessagePart } from '@/types/gmail';

export const maxDuration = 60;

/**
 * POST /api/gmail/bounce-scan/debug
 * Fetch bounce messages and show raw parsing details to improve extraction.
 * Auth: CRON_SECRET only.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { connection_id: string; limit?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: connection, error: connError } = await admin
    .from('gmail_connections')
    .select('*')
    .eq('id', body.connection_id)
    .single();

  if (connError || !connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  const accessToken = await getValidAccessToken(connection as GmailConnection);
  const limit = body.limit ?? 10;

  // Search for mailer-daemon messages
  const url = new URL(`${GMAIL_API_URL}/messages`);
  url.searchParams.set('q', 'from:mailer-daemon newer_than:60d');
  url.searchParams.set('maxResults', String(limit));

  const listResp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const listData = await listResp.json();

  if (!listData.messages) {
    return NextResponse.json({ message: 'No bounce messages found', count: 0 });
  }

  const samples: Array<{
    id: string;
    subject: string;
    from: string;
    to: string;
    snippet: string;
    has_delivery_status_part: boolean;
    delivery_status_content: string | null;
    text_body_preview: string;
    all_emails_found: string[];
    mime_structure: string[];
  }> = [];

  for (const msg of listData.messages.slice(0, limit)) {
    const resp = await fetch(
      `${GMAIL_API_URL}/messages/${msg.id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!resp.ok) continue;
    const fullMsg: GmailMessage = await resp.json();

    const subject = fullMsg.payload.headers.find(h => h.name.toLowerCase() === 'subject')?.value ?? '';
    const from = fullMsg.payload.headers.find(h => h.name.toLowerCase() === 'from')?.value ?? '';
    const to = fullMsg.payload.headers.find(h => h.name.toLowerCase() === 'to')?.value ?? '';
    const xFailed = fullMsg.payload.headers.find(h => h.name.toLowerCase() === 'x-failed-recipients')?.value ?? null;

    // Walk MIME tree to find all parts and delivery-status
    const mimeStructure: string[] = [];
    let deliveryStatusContent: string | null = null;
    let textBody = '';
    let hasDeliveryStatus = false;

    function walkParts(parts: GmailMessagePart[] | undefined, body?: { data?: string; size?: number }, mimeType?: string, depth = 0) {
      const prefix = '  '.repeat(depth);
      if (mimeType) {
        mimeStructure.push(`${prefix}${mimeType}${body?.size ? ` (${body.size}b)` : ''}`);
      }
      if (body?.data && mimeType) {
        const decoded = Buffer.from(body.data, 'base64url').toString('utf-8');
        if (mimeType === 'message/delivery-status' || mimeType === 'text/rfc822-headers') {
          hasDeliveryStatus = true;
          deliveryStatusContent = decoded;
        }
        if (mimeType === 'text/plain') {
          textBody += decoded;
        }
        if (mimeType === 'text/html' && !textBody) {
          textBody += decoded.replace(/<[^>]*>/g, ' ');
        }
      }
      if (!parts) return;
      for (const part of parts) {
        mimeStructure.push(`${prefix}${part.mimeType}${part.body?.size ? ` (${part.body.size}b)` : ''}${part.filename ? ` [${part.filename}]` : ''}`);
        if (part.body?.data) {
          const decoded = Buffer.from(part.body.data, 'base64url').toString('utf-8');
          if (part.mimeType === 'message/delivery-status' || part.mimeType === 'text/rfc822-headers') {
            hasDeliveryStatus = true;
            deliveryStatusContent = decoded;
          }
          if (part.mimeType === 'text/plain' && !textBody) {
            textBody += decoded;
          }
          if (part.mimeType === 'text/html' && !textBody) {
            textBody += decoded.replace(/<[^>]*>/g, ' ');
          }
        }
        if (part.parts) walkParts(part.parts, undefined, undefined, depth + 1);
      }
    }

    const topMime = fullMsg.payload.headers.find(h => h.name.toLowerCase() === 'content-type')?.value?.split(';')[0]?.trim();
    walkParts(fullMsg.payload.parts, fullMsg.payload.body, topMime);

    // Extract ALL email addresses found anywhere in body + delivery status
    const allContent = (textBody + '\n' + (deliveryStatusContent ?? '') + '\n' + (xFailed ?? '')).toLowerCase();
    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    const allEmails = [...new Set((allContent.match(emailRegex) ?? []))];

    samples.push({
      id: msg.id,
      subject,
      from,
      to,
      snippet: fullMsg.snippet ?? '',
      has_delivery_status_part: hasDeliveryStatus,
      delivery_status_content: deliveryStatusContent ? (deliveryStatusContent as string).slice(0, 500) : null,
      text_body_preview: textBody.slice(0, 500),
      all_emails_found: allEmails,
      mime_structure: mimeStructure,
    });
  }

  return NextResponse.json({
    total_messages: listData.resultSizeEstimate,
    samples_count: samples.length,
    samples,
  });
}

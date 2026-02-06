import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/gmail/service';
import { syncEmailsForConnection } from '@/lib/gmail/sync';

/**
 * Gmail Push Notification Webhook
 * Receives Pub/Sub messages when Gmail mailboxes change
 * Authentication via Google OIDC token (configured in Pub/Sub subscription)
 */
export async function POST(request: Request) {
  try {
    // Verify the OIDC token from Google Pub/Sub
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[Gmail Webhook] Missing or invalid Authorization header');
      return new Response('Unauthorized', { status: 401 });
    }

    const token = authHeader.slice(7);
    const expectedAudience = 'https://good-rev-crm.vercel.app/api/gmail/webhook';

    // Verify the token with Google
    const verifyResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`
    );

    if (!verifyResponse.ok) {
      console.error('[Gmail Webhook] Token verification failed');
      return new Response('Unauthorized', { status: 401 });
    }

    const tokenInfo = await verifyResponse.json();

    // Verify the audience matches our webhook URL
    if (tokenInfo.aud !== expectedAudience) {
      console.error('[Gmail Webhook] Invalid audience:', tokenInfo.aud);
      return new Response('Unauthorized', { status: 401 });
    }

    // Verify it's from our service account
    if (!tokenInfo.email?.endsWith('.iam.gserviceaccount.com')) {
      console.error('[Gmail Webhook] Invalid issuer email:', tokenInfo.email);
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();

    // Pub/Sub sends: { message: { data: base64, messageId, publishTime }, subscription }
    if (!body.message?.data) {
      return NextResponse.json({ error: 'Invalid Pub/Sub message' }, { status: 400 });
    }

    // Decode the Pub/Sub message data
    const decoded = Buffer.from(body.message.data, 'base64').toString('utf-8');
    let notification: { emailAddress: string; historyId: string };

    try {
      notification = JSON.parse(decoded);
    } catch {
      console.error('[Gmail Webhook] Failed to parse notification:', decoded);
      return NextResponse.json({ error: 'Invalid notification data' }, { status: 400 });
    }

    if (!notification.emailAddress || typeof notification.emailAddress !== 'string' || !notification.emailAddress.includes('@')) {
      return NextResponse.json({ error: 'Missing emailAddress' }, { status: 400 });
    }

    const emailForLog = notification.emailAddress.replace(/^(.{1,3}).*@/, '$1***@');
    console.log(`[Gmail Webhook] Notification for ${emailForLog}, historyId: ${notification.historyId}`);

    // Look up the Gmail connection
    const supabase = createAdminClient();
    const { data: connections } = await supabase
      .from('gmail_connections')
      .select('id')
      .eq('email', notification.emailAddress.toLowerCase())
      .eq('status', 'connected')
      .eq('sync_enabled', true);

    if (!connections || connections.length === 0) {
      return NextResponse.json({ ok: true });
    }

    // Sync each matching connection
    for (const conn of connections) {
      try {
        await syncEmailsForConnection(conn.id);
      } catch (error) {
        console.error(`[Gmail Webhook] Sync failed for connection ${conn.id}:`, error);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Gmail Webhook] Error:', error);
    // Return 200 to acknowledge and prevent Pub/Sub retries on permanent errors
    return NextResponse.json({ ok: true });
  }
}

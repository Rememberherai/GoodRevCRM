import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncEmailsForConnection } from '@/lib/gmail/sync';

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Gmail Push Notification Webhook
 * Receives Pub/Sub messages when Gmail mailboxes change
 */
export async function POST(request: Request) {
  try {
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

    if (!notification.emailAddress) {
      return NextResponse.json({ error: 'Missing emailAddress' }, { status: 400 });
    }

    console.log(`[Gmail Webhook] Notification for ${notification.emailAddress}, historyId: ${notification.historyId}`);

    // Look up the Gmail connection
    const supabase = createAdminClient();
    const { data: connections } = await supabase
      .from('gmail_connections')
      .select('id')
      .eq('email', notification.emailAddress.toLowerCase())
      .eq('status', 'connected')
      .eq('sync_enabled', true);

    if (!connections || connections.length === 0) {
      // No matching connection — acknowledge anyway to avoid retries
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Sync each matching connection
    const results = [];
    for (const conn of connections) {
      try {
        const result = await syncEmailsForConnection(conn.id);
        results.push({ connection_id: conn.id, ...result });
      } catch (error) {
        console.error(`[Gmail Webhook] Sync failed for connection ${conn.id}:`, error);
        results.push({
          connection_id: conn.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    console.error('[Gmail Webhook] Error:', error);
    // Return 200 to acknowledge and prevent Pub/Sub retries on permanent errors
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 200 });
  }
}

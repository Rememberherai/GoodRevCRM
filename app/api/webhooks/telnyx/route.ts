import { NextResponse } from 'next/server';
import {
  processCallEvent,
  processSmsEvent,
  verifyWebhookSignature,
  type TelnyxWebhookEvent,
  type TelnyxSmsWebhookEvent,
} from '@/lib/telnyx/webhooks';

// SMS event types to route to the SMS handler
const SMS_EVENT_TYPES = [
  'message.sent',
  'message.delivered',
  'message.failed',
  'message.received',
  'message.finalized',
];

// POST /api/webhooks/telnyx - Receive Telnyx webhook events (calls and SMS)
export async function POST(request: Request) {
  try {
    const body = await request.text();

    // Verify webhook signature
    const signature = request.headers.get('telnyx-signature-ed25519');
    const timestamp = request.headers.get('telnyx-timestamp');

    if (!verifyWebhookSignature(body, signature, timestamp)) {
      console.warn('Telnyx webhook signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const parsed = JSON.parse(body);

    // Validate the webhook payload has the expected shape
    if (!parsed?.data?.event_type || !parsed?.data?.payload) {
      console.warn('Invalid Telnyx webhook payload shape:', JSON.stringify(parsed).slice(0, 200));
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const eventType = parsed.data.event_type as string;

    console.log('[Telnyx Webhook] Received event:', eventType);

    // Route to appropriate handler based on event type
    if (SMS_EVENT_TYPES.includes(eventType)) {
      // SMS event
      const smsEvent = parsed as TelnyxSmsWebhookEvent;
      processSmsEvent(smsEvent).catch((err) => {
        console.error('Error processing Telnyx SMS webhook event:', err);
      });
    } else {
      // Call event
      const callEvent = parsed as TelnyxWebhookEvent;
      console.log('[Telnyx Webhook] Call event - call_control_id:', callEvent.data.payload?.call_control_id);
      processCallEvent(callEvent).catch((err) => {
        console.error('Error processing Telnyx call webhook event:', err);
      });
    }

    // Always return 200 immediately to acknowledge receipt
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Error in POST /api/webhooks/telnyx:', error);
    // Still return 200 to prevent Telnyx from retrying
    return NextResponse.json({ received: true }, { status: 200 });
  }
}

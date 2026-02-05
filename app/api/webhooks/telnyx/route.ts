import { NextResponse } from 'next/server';
import { processCallEvent, verifyWebhookSignature, type TelnyxWebhookEvent } from '@/lib/telnyx/webhooks';

// POST /api/webhooks/telnyx - Receive Telnyx webhook events
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

    const event = parsed as TelnyxWebhookEvent;

    // Process the event asynchronously (fire-and-forget)
    processCallEvent(event).catch((err) => {
      console.error('Error processing Telnyx webhook event:', err);
    });

    // Always return 200 immediately to acknowledge receipt
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Error in POST /api/webhooks/telnyx:', error);
    // Still return 200 to prevent Telnyx from retrying
    return NextResponse.json({ received: true }, { status: 200 });
  }
}

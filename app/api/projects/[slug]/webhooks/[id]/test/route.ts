import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { testWebhookSchema } from '@/lib/validators/webhook';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// POST /api/projects/[slug]/webhooks/[id]/test - Test webhook
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Get webhook
    const { data: webhook, error: webhookError } = await supabaseAny
      .from('webhooks')
      .select('*')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (webhookError || !webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const body = await request.json();
    const validationResult = testWebhookSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { event_type, payload } = validationResult.data;

    // Build test payload
    const testPayload = {
      event: event_type,
      timestamp: new Date().toISOString(),
      test: true,
      data: {
        id: '00000000-0000-0000-0000-000000000000',
        ...payload,
      },
    };

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': event_type,
      'X-Webhook-Delivery': 'test',
      'X-Webhook-Timestamp': testPayload.timestamp,
      ...webhook.headers,
    };

    // Add signature if secret is set
    if (webhook.secret) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(webhook.secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(JSON.stringify(testPayload))
      );
      const signatureHex = Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      headers['X-Webhook-Signature'] = `sha256=${signatureHex}`;
    }

    const startTime = Date.now();
    let responseStatus: number | null = null;
    let responseBody: string | null = null;
    let errorMessage: string | null = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), webhook.timeout_ms);

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(testPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      responseStatus = response.status;
      responseBody = await response.text();
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Request timed out';
        } else {
          errorMessage = error.message;
        }
      } else {
        errorMessage = 'Unknown error';
      }
    }

    const durationMs = Date.now() - startTime;

    // Create delivery record
    const { data: delivery } = await supabaseAny
      .from('webhook_deliveries')
      .insert({
        webhook_id: id,
        event_type,
        payload: testPayload,
        request_headers: headers,
        response_status: responseStatus,
        response_body: responseBody,
        duration_ms: durationMs,
        status: responseStatus && responseStatus >= 200 && responseStatus < 300 ? 'delivered' : 'failed',
        error_message: errorMessage,
        delivered_at: responseStatus && responseStatus >= 200 && responseStatus < 300 ? new Date().toISOString() : null,
      })
      .select()
      .single();

    return NextResponse.json({
      success: responseStatus !== null && responseStatus >= 200 && responseStatus < 300,
      delivery,
      response: {
        status: responseStatus,
        body: responseBody,
        duration_ms: durationMs,
      },
      error: errorMessage,
    });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/webhooks/[id]/test:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

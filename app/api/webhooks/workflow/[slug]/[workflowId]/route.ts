/**
 * POST /api/webhooks/workflow/[slug]/[workflowId]
 *
 * Public inbound webhook receiver that triggers a workflow execution.
 * No user session required — authenticated via secret token only.
 *
 * Token can be passed as:
 *   - Query param:  ?token=<plaintext>
 *   - Header:       Authorization: Bearer <plaintext>
 *
 * Returns 202 immediately; workflow runs asynchronously.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { decrypt } from '@/lib/encryption';

interface RouteContext {
  params: Promise<{ slug: string; workflowId: string }>;
}

const MAX_BODY_BYTES = 1_048_576; // 1 MB

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, workflowId } = await context.params;

    // ── 1. Extract token ───────────────────────────────────────────────────
    const url = new URL(request.url);
    const queryToken = url.searchParams.get('token');
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const providedToken = queryToken || bearerToken;

    if (!providedToken) {
      return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    }

    // ── 2. Look up project + workflow ──────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) {
      // Return 401 to avoid revealing whether the project exists
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { data: workflow } = await supabase
      .from('workflows')
      .select('id, current_version, definition, trigger_config')
      .eq('id', workflowId)
      .eq('project_id', project.id)
      .eq('trigger_type', 'webhook_inbound')
      .eq('is_active', true)
      .single();

    if (!workflow) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // ── 3. Verify token (timing-safe) ──────────────────────────────────────
    const encryptedSecret = workflow.trigger_config?.webhook_secret_enc as string | undefined;
    if (!encryptedSecret) {
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 401 });
    }

    let storedToken: string;
    try {
      storedToken = decrypt(encryptedSecret);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (!safeEqual(storedToken, providedToken)) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // ── 4. Parse body (enforce size limit) ────────────────────────────────
    // Check Content-Length first as a fast-path rejection, but also read the
    // actual body into a buffer so the limit is enforced even when the header
    // is absent or mismatched (callers are not required to send Content-Length).
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large (max 1 MB)' }, { status: 413 });
    }

    let rawBody: ArrayBuffer;
    try {
      rawBody = await request.arrayBuffer();
    } catch {
      rawBody = new ArrayBuffer(0);
    }
    if (rawBody.byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large (max 1 MB)' }, { status: 413 });
    }

    let webhookPayload: unknown;
    const contentType = request.headers.get('content-type') ?? '';
    try {
      const bodyText = new TextDecoder().decode(rawBody);
      if (contentType.includes('application/json')) {
        webhookPayload = bodyText ? JSON.parse(bodyText) : null;
      } else {
        webhookPayload = bodyText || null;
      }
    } catch {
      webhookPayload = null;
    }

    // ── 5. Build initial context data ──────────────────────────────────────
    const contextData: Record<string, unknown> = {
      webhook_payload: webhookPayload,
      webhook_headers: {
        'content-type': request.headers.get('content-type'),
        'user-agent': request.headers.get('user-agent'),
        'x-forwarded-for': request.headers.get('x-forwarded-for'),
      },
      triggered_at: new Date().toISOString(),
    };

    // ── 6. Create execution record ─────────────────────────────────────────
    const { data: executionId, error: rpcError } = await supabase.rpc('log_workflow_execution', {
      p_workflow_id: workflowId,
      p_workflow_version: workflow.current_version,
      p_trigger_event: { type: 'webhook_inbound' },
      p_status: 'running',
      p_entity_type: null,
      p_entity_id: null,
    });

    if (rpcError || !executionId) {
      console.error('Failed to create workflow execution:', rpcError);
      return NextResponse.json({ error: 'Failed to start execution' }, { status: 500 });
    }

    // Set context_data on the execution
    await supabase
      .from('workflow_executions')
      .update({ context_data: contextData })
      .eq('id', executionId);

    // ── 7. Fire workflow engine async (non-blocking) ───────────────────────
    const { executeWorkflow } = await import('@/lib/workflows/engine');
    executeWorkflow(workflowId, executionId, project.id, workflow.definition, contextData).catch(async (err: unknown) => {
      console.error('Inbound webhook workflow execution error:', err);
      await supabase
        .from('workflow_executions')
        .update({
          status: 'failed',
          error_message: err instanceof Error ? err.message : String(err),
          completed_at: new Date().toISOString(),
        })
        .eq('id', executionId);
    });

    return NextResponse.json({ received: true, execution_id: executionId }, { status: 202 });
  } catch (error) {
    console.error('Inbound webhook receiver error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

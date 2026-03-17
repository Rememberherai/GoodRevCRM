import { NextResponse } from 'next/server';
import { validateSigningToken } from '@/lib/contracts/signing-token';
import { createServiceClient } from '@/lib/supabase/server';
import { insertAuditTrail } from '@/lib/contracts/audit';
import { checkRateLimit } from '@/lib/contracts/rate-limit';
import { declineSchema } from '@/lib/validators/contract';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ua = request.headers.get('user-agent') ?? '';

  const { allowed } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const result = await validateSigningToken(token, 'sign');
  if (!result.valid || !result.recipient || !result.document) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
  }

  const body = await request.json().catch(() => ({}));
  const validation = declineSchema.safeParse(body);

  const { recipient, document } = result;
  const supabase = createServiceClient();

  // Update recipient
  await supabase
    .from('contract_recipients')
    .update({
      status: 'declined',
      declined_at: new Date().toISOString(),
      decline_reason: validation.success ? validation.data.reason ?? null : null,
    })
    .eq('id', recipient.id);

  // Update document status (CAS: only transition from active states)
  await supabase
    .from('contract_documents')
    .update({
      status: 'declined',
      declined_at: new Date().toISOString(),
    })
    .eq('id', document.id)
    .in('status', ['sent', 'viewed', 'partially_signed']);

  insertAuditTrail({
    project_id: recipient.project_id,
    document_id: document.id,
    recipient_id: recipient.id,
    action: 'declined',
    actor_type: 'signer',
    actor_name: recipient.name,
    ip_address: ip,
    user_agent: ua,
    details: { reason: validation.success ? validation.data.reason : undefined },
  });

  // Activity log
  try {
    const activityUserId = document.owner_id ?? document.created_by;
    if (activityUserId) {
      await supabase.from('activity_log').insert({
        project_id: recipient.project_id,
        user_id: activityUserId,
        entity_type: 'contract',
        entity_id: document.id,
        action: 'status_changed',
        metadata: { title: document.title, new_status: 'declined', declined_by: recipient.name },
      });
    }
  } catch {
    // Non-critical
  }

  emitAutomationEvent({
    projectId: recipient.project_id,
    triggerType: 'document.declined' as never,
    entityType: 'document' as never,
    entityId: document.id,
    data: { title: document.title, declined_by: recipient.name, reason: validation.success ? validation.data.reason : undefined },
  });

  return NextResponse.json({ success: true });
}

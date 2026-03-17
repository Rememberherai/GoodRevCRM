import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { voidContractSchema } from '@/lib/validators/contract';
import { insertAuditTrail } from '@/lib/contracts/audit';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { slug, id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const result = voidContractSchema.safeParse(body);

  const { data: document } = await supabase
    .from('contract_documents')
    .select('id, status, title, opportunity_id')
    .eq('id', id)
    .eq('project_id', project.id)
    .is('deleted_at', null)
    .single();

  if (!document) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  const nonVoidableStatuses = ['draft', 'completed', 'voided'];
  if (nonVoidableStatuses.includes(document.status)) {
    return NextResponse.json({ error: `Cannot void a ${document.status} contract` }, { status: 400 });
  }

  const adminClient = createServiceClient();

  const { data: voidedDocument, error } = await adminClient
    .from('contract_documents')
    .update({
      status: 'voided',
      voided_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('project_id', project.id)
    .in('status', ['sent', 'viewed', 'partially_signed', 'expired', 'declined'])
    .select('id')
    .single();

  if (error || !voidedDocument) {
    console.error('[CONTRACT_VOID] Failed:', error);
    return NextResponse.json({ error: 'Failed to void contract' }, { status: 409 });
  }

  insertAuditTrail({
    project_id: project.id,
    document_id: id,
    action: 'voided',
    actor_type: 'user',
    actor_id: user.id,
    details: { reason: result.success ? result.data.reason : undefined },
  });

  // Activity log
  try {
    await adminClient.from('activity_log').insert({
      project_id: project.id,
      user_id: user.id,
      entity_type: 'contract',
      entity_id: id,
      action: 'status_changed',
      metadata: { title: document.title, new_status: 'voided' },
    });
  } catch (err) {
    console.error('[CONTRACT_VOID] Activity log failed:', err);
  }

  emitAutomationEvent({
    projectId: project.id,
    triggerType: 'document.voided' as never,
    entityType: 'document' as never,
    entityId: id,
    data: { title: document.title, opportunity_id: document.opportunity_id },
  });

  return NextResponse.json({ success: true });
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateContractRecipientSchema } from '@/lib/validators/contract';

interface RouteContext {
  params: Promise<{ slug: string; id: string; rid: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { slug, id, rid } = await context.params;
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

  // Verify document is draft
  const { data: document } = await supabase
    .from('contract_documents')
    .select('id, status')
    .eq('id', id)
    .eq('project_id', project.id)
    .is('deleted_at', null)
    .single();

  if (!document) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  if (document.status !== 'draft') {
    return NextResponse.json({ error: 'Can only update recipients on draft contracts' }, { status: 400 });
  }

  const body = await request.json();
  const result = updateContractRecipientSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { data: recipient, error } = await supabase
    .from('contract_recipients')
    .update(result.data)
    .eq('id', rid)
    .eq('document_id', id)
    .eq('project_id', project.id)
    .select()
    .single();

  if (error || !recipient) {
    console.error('[CONTRACTS] Update recipient error:', error);
    return NextResponse.json({ error: 'Failed to update recipient' }, { status: 409 });
  }

  return NextResponse.json({ recipient });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { slug, id, rid } = await context.params;
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

  // Verify document is draft
  const { data: document } = await supabase
    .from('contract_documents')
    .select('id, status')
    .eq('id', id)
    .eq('project_id', project.id)
    .is('deleted_at', null)
    .single();

  if (!document) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  if (document.status !== 'draft') {
    return NextResponse.json({ error: 'Can only remove recipients from draft contracts' }, { status: 400 });
  }

  // Delete associated fields first
  await supabase
    .from('contract_fields')
    .delete()
    .eq('recipient_id', rid)
    .eq('document_id', id)
    .eq('project_id', project.id);

  const { data: deletedRecipient, error } = await supabase
    .from('contract_recipients')
    .delete()
    .eq('id', rid)
    .eq('document_id', id)
    .eq('project_id', project.id)
    .select('id')
    .single();

  if (error || !deletedRecipient) {
    console.error('[CONTRACTS] Delete recipient error:', error);
    return NextResponse.json({ error: 'Failed to delete recipient' }, { status: 409 });
  }

  return NextResponse.json({ success: true });
}

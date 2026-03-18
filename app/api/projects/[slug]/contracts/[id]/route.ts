import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateContractDocumentSchema } from '@/lib/validators/contract';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { Database } from '@/types/database';

type ContractDocument = Database['public']['Tables']['contract_documents']['Row'];

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
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

  const { data: document, error } = await supabase
    .from('contract_documents')
    .select('*, organization:organizations(id, name), person:people(id, first_name, last_name, email), opportunity:opportunities(id, name), owner:users!contract_documents_owner_id_fkey(id, full_name, email), template:contract_templates(id, name)')
    .eq('id', id)
    .eq('project_id', project.id)
    .is('deleted_at', null)
    .single();

  if (error || !document) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  // Fetch recipients
  const { data: recipients } = await supabase
    .from('contract_recipients')
    .select('*')
    .eq('document_id', id)
    .eq('project_id', project.id)
    .order('signing_order', { ascending: true });

  // Fetch fields
  const { data: fields } = await supabase
    .from('contract_fields')
    .select('*')
    .eq('document_id', id)
    .eq('project_id', project.id)
    .order('page_number', { ascending: true });

  return NextResponse.json({
    contract: {
      ...document,
      recipients: recipients ?? [],
      fields: fields ?? [],
    },
  });
}

export async function PATCH(request: Request, context: RouteContext) {
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

  // Verify document exists and is in draft
  const { data: existing } = await supabase
    .from('contract_documents')
    .select('id, status')
    .eq('id', id)
    .eq('project_id', project.id)
    .is('deleted_at', null)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  const body = await request.json();
  const result = updateContractDocumentSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 }
    );
  }

  // Settings that can be changed at any status
  const ALWAYS_EDITABLE = ['send_completed_copy_to_sender', 'send_completed_copy_to_recipients', 'reminder_enabled', 'reminder_interval_days', 'notify_on_view', 'notify_on_sign', 'notify_on_decline'];
  const editableKeys = Object.keys(result.data);
  const hasNonSettingsChanges = editableKeys.some((k) => !ALWAYS_EDITABLE.includes(k));

  if (hasNonSettingsChanges && existing.status !== 'draft') {
    return NextResponse.json({ error: 'Can only edit draft contracts' }, { status: 400 });
  }

  const updateData: Record<string, unknown> = { ...result.data };
  if (result.data.custom_fields) {
    updateData.custom_fields = result.data.custom_fields;
  }

  const query = supabase
    .from('contract_documents')
    .update(updateData)
    .eq('id', id)
    .eq('project_id', project.id);

  // Only restrict to draft status when making non-settings changes
  if (hasNonSettingsChanges) {
    query.eq('status', 'draft');
  }

  const { data: document, error } = await query.select().single();

  if (error || !document) {
    console.error('[CONTRACTS] Update error:', error);
    return NextResponse.json({ error: 'Failed to update contract' }, { status: 409 });
  }

  emitAutomationEvent({
    projectId: project.id,
    triggerType: 'entity.updated',
    entityType: 'document' as never,
    entityId: id,
    data: document as unknown as Record<string, unknown>,
  });

  return NextResponse.json({ contract: document as ContractDocument });
}

export async function DELETE(_request: Request, context: RouteContext) {
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

  const { data: existing } = await supabase
    .from('contract_documents')
    .select('id, status')
    .eq('id', id)
    .eq('project_id', project.id)
    .is('deleted_at', null)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  if (existing.status !== 'draft') {
    return NextResponse.json({ error: 'Can only delete draft contracts' }, { status: 400 });
  }

  // Soft delete
  const { data: deletedDocument, error } = await supabase
    .from('contract_documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('project_id', project.id)
    .eq('status', 'draft')
    .is('deleted_at', null)
    .select('id')
    .single();

  if (error || !deletedDocument) {
    console.error('[CONTRACTS] Delete error:', error);
    return NextResponse.json({ error: 'Failed to delete contract' }, { status: 409 });
  }

  return NextResponse.json({ success: true });
}

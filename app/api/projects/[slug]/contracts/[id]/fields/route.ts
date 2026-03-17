import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { bulkFieldsSchema } from '@/lib/validators/contract';
import type { Database } from '@/types/database';

type FieldInsert = Database['public']['Tables']['contract_fields']['Insert'];

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

  const { data: fields, error } = await supabase
    .from('contract_fields')
    .select('*')
    .eq('document_id', id)
    .eq('project_id', project.id)
    .order('page_number', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch fields' }, { status: 500 });
  }

  return NextResponse.json({ fields: fields ?? [] });
}

// PUT replaces all fields for a document (bulk save)
export async function PUT(request: Request, context: RouteContext) {
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
    return NextResponse.json({ error: 'Can only edit fields on draft contracts' }, { status: 400 });
  }

  const body = await request.json();
  const result = bulkFieldsSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 }
    );
  }

  // Validate all recipient_ids belong to this document
  const recipientIds = [...new Set(result.data.fields.map((f) => f.recipient_id))];
  let validRecipients: Array<{ id: string }> = [];
  if (recipientIds.length > 0) {
    const { data } = await supabase
      .from('contract_recipients')
      .select('id')
      .eq('document_id', id)
      .eq('project_id', project.id)
      .in('id', recipientIds);

    validRecipients = data ?? [];
  }

  const validIds = new Set(validRecipients.map((r) => r.id));
  const invalidIds = recipientIds.filter((rid) => !validIds.has(rid));

  if (invalidIds.length > 0) {
    return NextResponse.json(
      { error: `Invalid recipient IDs: ${invalidIds.join(', ')}` },
      { status: 400 }
    );
  }

  // Delete existing fields and insert new ones
  await supabase
    .from('contract_fields')
    .delete()
    .eq('document_id', id)
    .eq('project_id', project.id);

  if (result.data.fields.length === 0) {
    return NextResponse.json({ fields: [] });
  }

  const fieldInserts: FieldInsert[] = result.data.fields.map((f) => ({
    ...f,
    project_id: project.id,
    document_id: id,
    options: f.options as FieldInsert['options'],
  }));

  const { data: fields, error } = await supabase
    .from('contract_fields')
    .insert(fieldInserts)
    .select();

  if (error) {
    console.error('[CONTRACTS] Bulk fields error:', error);
    return NextResponse.json({ error: 'Failed to save fields' }, { status: 500 });
  }

  return NextResponse.json({ fields: fields ?? [] });
}

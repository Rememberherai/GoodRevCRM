import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createContractRecipientSchema } from '@/lib/validators/contract';
import type { Database } from '@/types/database';

type RecipientInsert = Database['public']['Tables']['contract_recipients']['Insert'];

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

  // Verify document exists and is not deleted
  const { data: document } = await supabase
    .from('contract_documents')
    .select('id')
    .eq('id', id)
    .eq('project_id', project.id)
    .is('deleted_at', null)
    .single();

  if (!document) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  const { data: recipients, error } = await supabase
    .from('contract_recipients')
    .select('*')
    .eq('document_id', id)
    .eq('project_id', project.id)
    .order('signing_order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch recipients' }, { status: 500 });
  }

  return NextResponse.json({ recipients: recipients ?? [] });
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

  // Verify document exists and is draft
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
    return NextResponse.json({ error: 'Can only add recipients to draft contracts' }, { status: 400 });
  }

  const body = await request.json();
  const result = createContractRecipientSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 }
    );
  }

  const recipientData: RecipientInsert = {
    ...result.data,
    project_id: project.id,
    document_id: id,
  };

  const { data: recipient, error } = await supabase
    .from('contract_recipients')
    .insert(recipientData)
    .select()
    .single();

  if (error) {
    console.error('[CONTRACTS] Add recipient error:', error);
    return NextResponse.json({ error: 'Failed to add recipient' }, { status: 500 });
  }

  return NextResponse.json({ recipient }, { status: 201 });
}

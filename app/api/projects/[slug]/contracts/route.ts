import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createContractDocumentSchema } from '@/lib/validators/contract';
import { insertAuditTrail } from '@/lib/contracts/audit';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { Database } from '@/types/database';

type ContractDocument = Database['public']['Tables']['contract_documents']['Row'];
type ContractDocumentInsert = Database['public']['Tables']['contract_documents']['Insert'];

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params;
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

  const { searchParams } = new URL(request.url);
  const page = Math.max(parseInt(searchParams.get('page') ?? '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '50', 10), 1), 200);
  const offset = (page - 1) * limit;
  const search = searchParams.get('search');
  const status = searchParams.get('status');
  const opportunityId = searchParams.get('opportunity_id');
  const sortBy = searchParams.get('sort_by') ?? 'created_at';
  const sortOrder = searchParams.get('sort_order') ?? 'desc';

  let query = supabase
    .from('contract_documents')
    .select('*, organization:organizations(id, name), person:people(id, first_name, last_name, email), opportunity:opportunities(id, name), owner:users!contract_documents_owner_id_fkey(id, full_name, email)', { count: 'exact' })
    .eq('project_id', project.id)
    .is('deleted_at', null);

  if (search) {
    const sanitized = search.replace(/[%_\\]/g, '\\$&').replace(/"/g, '""');
    query = query.or(`title.ilike."%${sanitized}%",description.ilike."%${sanitized}%"`);
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (opportunityId) {
    query = query.eq('opportunity_id', opportunityId);
  }

  const ALLOWED_SORT_COLUMNS = ['created_at', 'updated_at', 'title', 'status', 'sent_at', 'completed_at'];
  if (ALLOWED_SORT_COLUMNS.includes(sortBy)) {
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('[CONTRACTS] List error:', error);
    return NextResponse.json({ error: 'Failed to fetch contracts' }, { status: 500 });
  }

  return NextResponse.json({
    contracts: data,
    pagination: {
      page,
      limit,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / limit),
    },
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;
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

  const body = await request.json();
  const result = createContractDocumentSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 }
    );
  }

  const docData: ContractDocumentInsert = {
    ...result.data,
    project_id: project.id,
    created_by: user.id,
    owner_id: result.data.owner_id ?? user.id,
    custom_fields: (result.data.custom_fields ?? {}) as ContractDocumentInsert['custom_fields'],
  };

  const { data: document, error } = await supabase
    .from('contract_documents')
    .insert(docData)
    .select()
    .single();

  if (error) {
    console.error('[CONTRACTS] Create error:', error);
    return NextResponse.json({ error: 'Failed to create contract' }, { status: 500 });
  }

  const doc = document as ContractDocument;

  // Audit trail
  insertAuditTrail({
    project_id: project.id,
    document_id: doc.id,
    action: 'created',
    actor_type: 'user',
    actor_id: user.id,
  });

  // Automation event
  emitAutomationEvent({
    projectId: project.id,
    triggerType: 'entity.created',
    entityType: 'document' as never,
    entityId: doc.id,
    data: doc as unknown as Record<string, unknown>,
  });

  return NextResponse.json({ contract: doc }, { status: 201 });
}

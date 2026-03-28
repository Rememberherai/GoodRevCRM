import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyDocumentAccess } from '@/lib/contracts/access';
import { saveFields } from '@/lib/contracts/service';
import { bulkFieldsSchema } from '@/lib/validators/contract';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { authorized } = await verifyDocumentAccess(supabase, id, user.id);
  if (!authorized) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const { data: fields } = await supabase
    .from('contract_fields')
    .select('*')
    .eq('document_id', id)
    .order('page_number', { ascending: true });

  return NextResponse.json({ fields: fields ?? [] });
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { document, authorized } = await verifyDocumentAccess(supabase, id, user.id);
  if (!authorized || !document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  if (document.status !== 'draft') {
    return NextResponse.json({ error: 'Can only edit fields on draft documents' }, { status: 400 });
  }

  const body = await request.json();
  const result = bulkFieldsSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const fields = await saveFields({
      supabase,
      documentId: id,
      projectId: document.project_id,
      fields: result.data.fields,
    });
    return NextResponse.json({ fields });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to save fields' }, { status: 500 });
  }
}

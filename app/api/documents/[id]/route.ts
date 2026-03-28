import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateContractDocumentSchema } from '@/lib/validators/contract';
import { verifyDocumentAccess } from '@/lib/contracts/access';
import { getDocument, updateDocument, deleteDocument } from '@/lib/contracts/service';

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

  try {
    const document = await getDocument({ supabase, documentId: id });
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    return NextResponse.json({ document });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { document: existing, authorized } = await verifyDocumentAccess(supabase, id, user.id);
  if (!authorized || !existing) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const body = await request.json();
  const result = updateContractDocumentSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 }
    );
  }

  if (
    existing.project_id === null &&
    (
      result.data.organization_id !== undefined ||
      result.data.person_id !== undefined ||
      result.data.opportunity_id !== undefined
    )
  ) {
    const isTryingToLinkCrmEntity = (
      result.data.organization_id !== null ||
      result.data.person_id !== null ||
      result.data.opportunity_id !== null
    );

    if (isTryingToLinkCrmEntity) {
      return NextResponse.json(
        { error: 'Standalone documents cannot be linked to CRM records' },
        { status: 400 }
      );
    }
  }

  try {
    const document = await updateDocument({
      supabase,
      documentId: id,
      updates: result.data,
      currentStatus: existing.status,
    });
    return NextResponse.json({ document });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
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

  try {
    await deleteDocument({ supabase, documentId: id });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to delete' }, { status: 400 });
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyDocumentAccess } from '@/lib/contracts/access';
import { updateRecipient, deleteRecipient } from '@/lib/contracts/service';
import { updateContractRecipientSchema } from '@/lib/validators/contract';

interface RouteContext {
  params: Promise<{ id: string; rid: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id, rid } = await context.params;
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
    return NextResponse.json({ error: 'Can only edit recipients on draft documents' }, { status: 400 });
  }

  const body = await request.json();
  const result = updateContractRecipientSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const recipient = await updateRecipient({
      supabase,
      documentId: id,
      recipientId: rid,
      updates: result.data,
    });
    return NextResponse.json({ recipient });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update recipient' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id, rid } = await context.params;
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
    return NextResponse.json({ error: 'Can only delete recipients on draft documents' }, { status: 400 });
  }

  try {
    await deleteRecipient({ supabase, recipientId: rid, documentId: id });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to delete recipient' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyDocumentAccess } from '@/lib/contracts/access';
import { addRecipient } from '@/lib/contracts/service';
import { createContractRecipientSchema } from '@/lib/validators/contract';

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

  const { data: recipients } = await supabase
    .from('contract_recipients')
    .select('*')
    .eq('document_id', id)
    .order('signing_order', { ascending: true });

  return NextResponse.json({ recipients: recipients ?? [] });
}

export async function POST(request: Request, context: RouteContext) {
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
    return NextResponse.json({ error: 'Can only add recipients to draft documents' }, { status: 400 });
  }

  const body = await request.json();
  const result = createContractRecipientSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const recipient = await addRecipient({
      supabase,
      documentId: id,
      projectId: document.project_id,
      name: result.data.name,
      email: result.data.email,
      role: result.data.role,
      signingOrder: result.data.signing_order,
    });
    return NextResponse.json({ recipient }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to add recipient' }, { status: 500 });
  }
}

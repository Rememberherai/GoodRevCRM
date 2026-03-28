import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyDocumentAccess } from '@/lib/contracts/access';
import { voidDocument } from '@/lib/contracts/service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
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

  const body = await request.json().catch(() => ({}));
  const reason = (body as { reason?: string }).reason;

  try {
    await voidDocument({ supabase, documentId: id, userId: user.id, reason });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to void' }, { status: 400 });
  }
}

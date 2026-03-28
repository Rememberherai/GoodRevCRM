import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyDocumentAccess } from '@/lib/contracts/access';
import { remindRecipients } from '@/lib/contracts/service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
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

  try {
    const result = await remindRecipients({
      supabase,
      documentId: id,
      projectId: document.project_id,
      userId: user.id,
    });
    return NextResponse.json({ success: true, sent_count: result.sentCount });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to send reminders' }, { status: 400 });
  }
}

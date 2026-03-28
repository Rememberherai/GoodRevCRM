import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyDocumentAccess } from '@/lib/contracts/access';
import { sendDocument } from '@/lib/contracts/service';
import { sendContractSchema } from '@/lib/validators/contract';
import { emitAutomationEvent } from '@/lib/automations/engine';

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

  const { document, authorized } = await verifyDocumentAccess(supabase, id, user.id);
  if (!authorized || !document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const body = await request.json();
  const result = sendContractSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const sendResult = await sendDocument({
      supabase,
      documentId: id,
      projectId: document.project_id,
      userId: user.id,
      gmailConnectionId: result.data.gmail_connection_id,
      message: result.data.message,
    });

    if (document.project_id) {
      emitAutomationEvent({
        projectId: document.project_id,
        triggerType: 'document.sent' as never,
        entityType: 'document' as never,
        entityId: id,
        data: { title: document.title, sent_count: sendResult.sentCount },
      });
    }

    return NextResponse.json({
      success: true,
      sent_count: sendResult.sentCount,
      failed_count: sendResult.failedCount,
      ...(sendResult.failedCount > 0 ? { warning: `${sendResult.failedCount} recipient(s) failed to send` } : {}),
    });
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : 'Failed to send';
    const status = errMessage.includes('already been sent') ? 409 : 400;
    return NextResponse.json({ error: errMessage }, { status });
  }
}

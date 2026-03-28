import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyDocumentAccess } from '@/lib/contracts/access';
import { downloadDocument } from '@/lib/contracts/service';
import { insertAuditTrail } from '@/lib/contracts/audit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
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

  const { searchParams } = new URL(request.url);
  const version = (searchParams.get('version') ?? 'latest') as 'original' | 'latest';

  try {
    const result = await downloadDocument({ documentId: id, version });

    insertAuditTrail({
      project_id: document.project_id,
      document_id: id,
      action: 'downloaded',
      actor_type: 'user',
      actor_id: user.id,
      details: { version },
    });

    return new NextResponse(result.data, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to download';
    const status = message.includes('finalized') ? 409 : 404;
    return NextResponse.json({ error: message }, { status });
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyDocumentAccess } from '@/lib/contracts/access';
import { downloadCertificate } from '@/lib/contracts/service';

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
    const result = await downloadCertificate({ documentId: id });
    return new NextResponse(result.data, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Certificate not available' }, { status: 404 });
  }
}

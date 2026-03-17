import { NextResponse } from 'next/server';
import { validateSigningToken } from '@/lib/contracts/signing-token';
import { createServiceClient } from '@/lib/supabase/server';
import { insertAuditTrail } from '@/lib/contracts/audit';
import { checkRateLimit } from '@/lib/contracts/rate-limit';

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  const { allowed } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const result = await validateSigningToken(token, 'download');
  if (!result.valid || !result.recipient || !result.document) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
  }

  const supabase = createServiceClient();

  const { data: document } = await supabase
    .from('contract_documents')
    .select('signed_file_path, original_file_path, original_file_name')
    .eq('id', result.document.id)
    .single();

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  if (!document.signed_file_path) {
    return NextResponse.json({ error: 'Signed document is still being finalized' }, { status: 409 });
  }

  const filePath = document.signed_file_path;
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('contracts')
    .download(filePath);

  if (downloadError || !fileData) {
    return NextResponse.json({ error: 'Failed to download' }, { status: 500 });
  }

  insertAuditTrail({
    project_id: result.recipient.project_id,
    document_id: result.document.id,
    recipient_id: result.recipient.id,
    action: 'downloaded',
    actor_type: 'signer',
    actor_name: result.recipient.name,
    ip_address: ip,
  });

  const fileName = `signed_${document.original_file_name}`;

  const arrayBuffer = await fileData.arrayBuffer();
  return new NextResponse(arrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${(fileName ?? 'document.pdf').replace(/["\\\n\r]/g, '_')}"`,
    },
  });
}

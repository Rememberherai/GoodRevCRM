import { NextResponse } from 'next/server';
import { validateSigningToken } from '@/lib/contracts/signing-token';
import { createServiceClient } from '@/lib/supabase/server';
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

  const result = await validateSigningToken(token, 'view');
  if (!result.valid || !result.document) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
  }

  const supabase = createServiceClient();

  // Get document's file path
  const { data: document } = await supabase
    .from('contract_documents')
    .select('original_file_path')
    .eq('id', result.document.id)
    .single();

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // Stream PDF via service role proxy
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('contracts')
    .download(document.original_file_path);

  if (downloadError || !fileData) {
    console.error('[SIGN_DOCUMENT] Download failed:', downloadError);
    return NextResponse.json({ error: 'Failed to load document' }, { status: 500 });
  }

  const arrayBuffer = await fileData.arrayBuffer();
  return new NextResponse(arrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Cache-Control': 'private, no-store',
    },
  });
}

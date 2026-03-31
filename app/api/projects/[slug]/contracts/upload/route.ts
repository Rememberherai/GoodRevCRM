import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PDFDocument } from 'pdf-lib';
import crypto from 'crypto';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 });
  }

  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: 'File must be under 25MB' }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Get page count via pdf-lib
  let pageCount = 1;
  try {
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    pageCount = pdfDoc.getPageCount();
  } catch (err) {
    console.error('[CONTRACT_UPLOAD] Failed to read PDF:', err);
    return NextResponse.json({ error: 'Invalid or corrupted PDF file' }, { status: 400 });
  }

  // SHA-256 hash
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');

  // Upload to storage
  const fileId = crypto.randomUUID();
  // Sanitize filename to prevent path traversal (e.g. ../../admin/secrets.pdf)
  const ext = (file.name.match(/\.[a-zA-Z0-9]+$/) || ['.pdf'])[0];
  const safeName = `${fileId}${ext}`;
  const storagePath = `${project.id}/documents/${fileId}/${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from('contracts')
    .upload(storagePath, bytes, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    console.error('[CONTRACT_UPLOAD] Storage upload failed:', uploadError);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }

  return NextResponse.json({
    file_path: storagePath,
    file_name: file.name,
    file_hash: hash,
    page_count: pageCount,
    file_size: file.size,
  });
}

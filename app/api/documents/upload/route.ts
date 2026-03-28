import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadDocumentPdf } from '@/lib/contracts/service';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  try {
    const result = await uploadDocumentPdf({
      supabase,
      userId: user.id,
      projectId: null, // Standalone
      file,
    });

    return NextResponse.json({
      file_path: result.filePath,
      file_name: result.fileName,
      file_hash: result.fileHash,
      page_count: result.pageCount,
      file_size: result.fileSize,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to upload file';
    const status = message.includes('PDF') || message.includes('25MB') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

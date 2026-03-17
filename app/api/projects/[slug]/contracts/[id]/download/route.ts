import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { insertAuditTrail } from '@/lib/contracts/audit';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { slug, id } = await context.params;
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

  const { data: document } = await supabase
    .from('contract_documents')
    .select('id, title, original_file_path, original_file_name, signed_file_path, status')
    .eq('id', id)
    .eq('project_id', project.id)
    .is('deleted_at', null)
    .single();

  if (!document) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const version = searchParams.get('version') ?? 'latest';

  if (version !== 'original' && document.status === 'completed' && !document.signed_file_path) {
    return NextResponse.json(
      { error: 'Signed document is still being finalized' },
      { status: 409 }
    );
  }

  // Use signed version if available and requested, otherwise original
  const filePath = version === 'original' || !document.signed_file_path
    ? document.original_file_path
    : document.signed_file_path;

  const adminClient = createServiceClient();
  const { data: fileData, error: downloadError } = await adminClient.storage
    .from('contracts')
    .download(filePath);

  if (downloadError || !fileData) {
    console.error('[CONTRACT_DOWNLOAD] Failed:', downloadError);
    return NextResponse.json({ error: 'Failed to download file' }, { status: 500 });
  }

  const fileName = document.signed_file_path && version !== 'original'
    ? `signed_${document.original_file_name}`
    : document.original_file_name;

  insertAuditTrail({
    project_id: project.id,
    document_id: id,
    action: 'downloaded',
    actor_type: 'user',
    actor_id: user.id,
    details: { version },
  });

  const arrayBuffer = await fileData.arrayBuffer();
  return new NextResponse(arrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${(fileName ?? 'document.pdf').replace(/["\\\n\r]/g, '_')}"`,
    },
  });
}

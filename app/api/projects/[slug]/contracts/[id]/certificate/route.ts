import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
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
    .select('id, title, certificate_file_path, status')
    .eq('id', id)
    .eq('project_id', project.id)
    .is('deleted_at', null)
    .single();

  if (!document) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  if (document.status !== 'completed' || !document.certificate_file_path) {
    return NextResponse.json({ error: 'Certificate not available' }, { status: 404 });
  }

  const adminClient = createServiceClient();
  const { data: fileData, error } = await adminClient.storage
    .from('contracts')
    .download(document.certificate_file_path);

  if (error || !fileData) {
    return NextResponse.json({ error: 'Failed to download certificate' }, { status: 500 });
  }

  const arrayBuffer = await fileData.arrayBuffer();
  return new NextResponse(arrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="certificate_${document.title.replace(/["\\\n\r]/g, '_')}.pdf"`,
    },
  });
}

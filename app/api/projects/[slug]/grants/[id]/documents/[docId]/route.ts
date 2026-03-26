import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { updateGrantDocumentSchema } from '@/lib/validators/community/grant-documents';

interface RouteContext {
  params: Promise<{ slug: string; id: string; docId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id: grantId, docId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project || !['community', 'grants'].includes(project.project_type))
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'grants', 'view');

    const { data: doc } = await supabase
      .from('grant_documents')
      .select('*')
      .eq('id', docId)
      .eq('grant_id', grantId)
      .eq('project_id', project.id)
      .single();

    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    // Generate signed download URL
    const { data: signedUrl, error: signError } = await supabase.storage
      .from('grant-documents')
      .createSignedUrl(doc.file_path, 3600); // 1 hour

    if (signError) throw signError;

    return NextResponse.json({ document: doc, download_url: signedUrl?.signedUrl });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /api/projects/[slug]/grants/[id]/documents/[docId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id: grantId, docId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project || !['community', 'grants'].includes(project.project_type))
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'grants', 'update');

    const body = await request.json();
    const validation = updateGrantDocumentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('grant_documents')
      .update(validation.data)
      .eq('id', docId)
      .eq('grant_id', grantId)
      .eq('project_id', project.id)
      .select()
      .single();

    if (error || !data) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    return NextResponse.json({ document: data });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in PATCH /api/projects/[slug]/grants/[id]/documents/[docId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id: grantId, docId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project || !['community', 'grants'].includes(project.project_type))
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'grants', 'delete');

    // Get document to delete storage file
    const { data: doc } = await supabase
      .from('grant_documents')
      .select('file_path')
      .eq('id', docId)
      .eq('grant_id', grantId)
      .eq('project_id', project.id)
      .single();

    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    // Delete storage file
    await supabase.storage.from('grant-documents').remove([doc.file_path]);

    // Delete record
    const { error } = await supabase
      .from('grant_documents')
      .delete()
      .eq('id', docId)
      .eq('grant_id', grantId)
      .eq('project_id', project.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in DELETE /api/projects/[slug]/grants/[id]/documents/[docId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

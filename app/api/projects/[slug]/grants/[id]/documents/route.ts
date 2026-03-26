import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { createGrantDocumentSchema } from '@/lib/validators/community/grant-documents';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id: grantId } = await context.params;
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

    const { data, error } = await supabase
      .from('grant_documents')
      .select('*')
      .eq('grant_id', grantId)
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ documents: data ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /api/projects/[slug]/grants/[id]/documents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id: grantId } = await context.params;
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

    await requireCommunityPermission(supabase, user.id, project.id, 'grants', 'create');

    // Handle multipart form data for file upload
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const metadataStr = formData.get('metadata') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    let metadata: Record<string, unknown> = {};
    if (metadataStr) {
      try {
        metadata = JSON.parse(metadataStr);
      } catch {
        return NextResponse.json({ error: 'Invalid metadata JSON' }, { status: 400 });
      }
    }
    const validation = createGrantDocumentSchema.safeParse({
      ...metadata,
      grant_id: grantId,
      file_name: file.name,
      file_size_bytes: file.size,
      mime_type: file.type || undefined,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 },
      );
    }

    // Upload file to Supabase Storage
    const fileExt = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const storagePath = `${project.id}/${grantId}/${crypto.randomUUID()}.${fileExt}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from('grant-documents')
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Create document record
    const { data, error } = await supabase
      .from('grant_documents')
      .insert({
        grant_id: grantId,
        project_id: project.id,
        uploaded_by: user.id,
        document_type: validation.data.document_type,
        label: validation.data.label,
        file_path: storagePath,
        file_name: validation.data.file_name,
        file_size_bytes: validation.data.file_size_bytes ?? null,
        mime_type: validation.data.mime_type ?? null,
        is_required: validation.data.is_required,
        is_submitted: validation.data.is_submitted,
        notes: validation.data.notes ?? null,
      })
      .select()
      .single();

    if (error || !data) throw error ?? new Error('Failed to create document record');

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'grant.document_uploaded' as never,
      entityType: 'grant' as never,
      entityId: grantId,
      data: { document: data as unknown as Record<string, unknown>, grant_id: grantId },
    });

    return NextResponse.json({ document: data }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in POST /api/projects/[slug]/grants/[id]/documents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

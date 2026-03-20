import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import {
  COMMUNITY_UPLOAD_BUCKET,
  buildCommunityReceiptStoragePath,
  buildReceiptUploadMessage,
} from '@/lib/assistant/storage';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
]);

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.project_type !== 'community') {
      return NextResponse.json({ error: 'Receipt upload is only available for community projects' }, { status: 400 });
    }

    await requireCommunityPermission(supabase, user.id, project.id, 'assistant_ap', 'create');

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ACCEPTED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Only receipt images and PDFs are supported' }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File must be under 15MB' }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const storagePath = buildCommunityReceiptStoragePath(project.id, file.name);

    const { error: uploadError } = await supabase.storage
      .from(COMMUNITY_UPLOAD_BUCKET)
      .upload(storagePath, bytes, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[COMMUNITY_UPLOAD] Failed to upload receipt:', uploadError);
      return NextResponse.json({ error: 'Failed to upload receipt' }, { status: 500 });
    }

    return NextResponse.json({
      bucket: COMMUNITY_UPLOAD_BUCKET,
      storage_path: storagePath,
      content_type: file.type,
      file_name: file.name,
      message_text: buildReceiptUploadMessage({
        bucket: COMMUNITY_UPLOAD_BUCKET,
        storagePath,
        contentType: file.type,
        fileName: file.name,
      }),
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    console.error('[COMMUNITY_UPLOAD] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


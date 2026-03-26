import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'update');

    const { data: event } = await supabase
      .from('events').select('id').eq('id', id).eq('project_id', project.id).single();
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 5MB' }, { status: 400 });
    }

    const extension = file.type === 'image/png'
      ? 'png'
      : file.type === 'image/gif'
        ? 'gif'
        : file.type === 'image/webp'
          ? 'webp'
          : 'jpg';
    const storagePath = `${project.id}/${id}/cover.${extension}`;

    const admin = createAdminClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from('event-covers')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Event cover upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    const { data: urlData } = admin.storage.from('event-covers').getPublicUrl(storagePath);
    const coverImageUrl = urlData.publicUrl;

    const { error: updateError } = await admin
      .from('events')
      .update({ cover_image_url: coverImageUrl })
      .eq('id', id)
      .eq('project_id', project.id);

    if (updateError) {
      console.error('Error updating event cover_image_url:', updateError);
      return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
    }

    return NextResponse.json({ cover_image_url: coverImageUrl });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in POST /api/projects/[slug]/events/[id]/upload-cover:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

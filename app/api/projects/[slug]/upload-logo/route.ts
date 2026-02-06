import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project to verify access and get project ID
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const entityType = formData.get('entityType') as string | null;
    const entityId = formData.get('entityId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 2MB' }, { status: 400 });
    }

    if (!entityType || !['project', 'organization'].includes(entityType)) {
      return NextResponse.json({ error: 'Invalid entityType' }, { status: 400 });
    }

    if (entityType === 'organization' && !entityId) {
      return NextResponse.json({ error: 'entityId required for organization logos' }, { status: 400 });
    }

    if (entityId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entityId)) {
      return NextResponse.json({ error: 'Invalid entityId format' }, { status: 400 });
    }

    if (entityType === 'organization') {
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('id', entityId!)
        .eq('project_id', project.id)
        .single();

      if (!org) {
        return NextResponse.json({ error: 'Organization not found in this project' }, { status: 404 });
      }
    }

    // Determine storage path
    const ext = 'webp';
    const storagePath = entityType === 'project'
      ? `${project.id}/project.${ext}`
      : `${project.id}/org/${entityId}.${ext}`;

    const admin = createAdminClient();

    // Upload to Supabase Storage (upsert to overwrite existing)
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage
      .from('logos')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = admin.storage
      .from('logos')
      .getPublicUrl(storagePath);

    const logoUrl = urlData.publicUrl;

    // Update the entity's logo_url in the database
    if (entityType === 'project') {
      const { error: updateError } = await admin
        .from('projects')
        .update({ logo_url: logoUrl })
        .eq('id', project.id);

      if (updateError) {
        console.error('Error updating project logo_url:', updateError);
        return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
      }
    } else {
      const { error: updateError } = await admin
        .from('organizations')
        .update({ logo_url: logoUrl })
        .eq('id', entityId!)
        .eq('project_id', project.id);

      if (updateError) {
        console.error('Error updating organization logo_url:', updateError);
        return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 });
      }
    }

    return NextResponse.json({ logo_url: logoUrl });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/upload-logo:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

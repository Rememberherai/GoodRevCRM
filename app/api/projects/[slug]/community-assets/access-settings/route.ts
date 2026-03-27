import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { upsertHubSettingsSchema } from '@/lib/validators/asset-access';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project || project.project_type !== 'community') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const role = await requireCommunityPermission(supabase, user.id, project.id, 'asset_access', 'manage');
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can manage hub settings' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('asset_access_settings')
      .select('*')
      .eq('project_id', project.id)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ settings: data });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/community-assets/access-settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project || project.project_type !== 'community') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const role = await requireCommunityPermission(supabase, user.id, project.id, 'asset_access', 'manage');
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can manage hub settings' }, { status: 403 });
    }

    const body = await request.json();
    const validation = upsertHubSettingsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { data: settings, error } = await supabase
      .from('asset_access_settings')
      .upsert(
        { ...validation.data, project_id: project.id },
        { onConflict: 'project_id' }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PUT /api/projects/[slug]/community-assets/access-settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

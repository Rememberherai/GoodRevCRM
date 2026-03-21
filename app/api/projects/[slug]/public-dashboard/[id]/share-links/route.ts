import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { createShareLinkSchema } from '@/lib/validators/community/public-dashboard';
import { createShareToken } from '@/lib/community/public-dashboard-auth';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

async function getProjectContext(slug: string) {
  const supabase = await createClient();
  const { data: project } = await supabase.from('projects').select('id, project_type').eq('slug', slug).is('deleted_at', null).single();
  return { supabase, project };
}

async function requireProjectConfig(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  configId: string,
  projectId: string
) {
  const { data: config } = await supabase
    .from('public_dashboard_configs')
    .select('id')
    .eq('id', configId)
    .eq('project_id', projectId)
    .maybeSingle();

  return config;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const { supabase, project } = await getProjectContext(slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!project || project.project_type !== 'community') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    await requireCommunityPermission(supabase, user.id, project.id, 'public_dashboard', 'manage');
    const config = await requireProjectConfig(supabase, id, project.id);
    if (!config) return NextResponse.json({ error: 'Public dashboard config not found' }, { status: 404 });

    const { data, error } = await supabase
      .from('public_dashboard_share_links')
      .select('*')
      .eq('config_id', id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ share_links: data ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /api/projects/[slug]/public-dashboard/[id]/share-links:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const { supabase, project } = await getProjectContext(slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!project || project.project_type !== 'community') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    await requireCommunityPermission(supabase, user.id, project.id, 'public_dashboard', 'manage');
    const config = await requireProjectConfig(supabase, id, project.id);
    if (!config) return NextResponse.json({ error: 'Public dashboard config not found' }, { status: 404 });

    const body = await request.json();
    const validation = createShareLinkSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('public_dashboard_share_links')
      .insert({
        config_id: id,
        token: createShareToken(),
        label: validation.data.label ?? null,
        expires_at: validation.data.expires_at ?? null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error || !data) throw error ?? new Error('Failed to create share link');
    return NextResponse.json({ share_link: data }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in POST /api/projects/[slug]/public-dashboard/[id]/share-links:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const { supabase, project } = await getProjectContext(slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!project || project.project_type !== 'community') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    await requireCommunityPermission(supabase, user.id, project.id, 'public_dashboard', 'manage');
    const config = await requireProjectConfig(supabase, id, project.id);
    if (!config) return NextResponse.json({ error: 'Public dashboard config not found' }, { status: 404 });

    const shareLinkId = new URL(request.url).searchParams.get('share_link_id');
    if (!shareLinkId) return NextResponse.json({ error: 'share_link_id is required' }, { status: 400 });

    const { error } = await supabase
      .from('public_dashboard_share_links')
      .delete()
      .eq('id', shareLinkId)
      .eq('config_id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in DELETE /api/projects/[slug]/public-dashboard/[id]/share-links:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, project_type, impact_framework_id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.project_type !== 'community') {
      return NextResponse.json({ error: 'Not a community project' }, { status: 400 });
    }

    await requireCommunityPermission(supabase, user.id, project.id, 'dashboard', 'view');

    if (!project.impact_framework_id) {
      return NextResponse.json({ dimensions: [] });
    }

    const { data: dimensions, error } = await supabase
      .from('impact_dimensions')
      .select('id, key, label, color, icon, description, sort_order')
      .eq('framework_id', project.impact_framework_id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching impact dimensions:', error);
      return NextResponse.json({ error: 'Failed to fetch impact dimensions' }, { status: 500 });
    }

    return NextResponse.json({ dimensions: dimensions ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/impact-dimensions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

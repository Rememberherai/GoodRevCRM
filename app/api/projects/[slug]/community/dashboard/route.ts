import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCommunityDashboardData } from '@/lib/community/dashboard';
import type { ProjectRole } from '@/types/user';

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
      .select('id, name, slug, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.project_type !== 'community') {
      return NextResponse.json({ error: 'Community dashboard is only available for community projects' }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from('project_memberships')
      .select('role')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Not a project member' }, { status: 403 });
    }

    const dashboardData = await getCommunityDashboardData(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      project.id,
      membership.role as ProjectRole
    );

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        slug: project.slug,
      },
      ...dashboardData,
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/community/dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

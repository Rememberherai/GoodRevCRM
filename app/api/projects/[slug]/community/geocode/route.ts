import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { processPendingCommunityGeocodes } from '@/lib/community/geocoding-queue';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

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

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.project_type !== 'community') {
      return NextResponse.json({ error: 'Geocoding is only available for community projects' }, { status: 404 });
    }

    await requireCommunityPermission(supabase, user.id, project.id, 'households', 'update');
    await requireCommunityPermission(supabase, user.id, project.id, 'community_assets', 'update');

    const body = await request.json().catch(() => ({})) as { limit?: number };
    const limit = typeof body.limit === 'number' ? Math.max(1, Math.min(body.limit, 50)) : 20;

    const summary = await processPendingCommunityGeocodes(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      project.id,
      limit
    );

    return NextResponse.json({ summary });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/community/geocode:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

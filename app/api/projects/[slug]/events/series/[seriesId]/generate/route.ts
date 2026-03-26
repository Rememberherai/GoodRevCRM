import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { generateSeriesInstances } from '@/lib/events/series';

interface RouteContext {
  params: Promise<{ slug: string; seriesId: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { slug, seriesId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'update');

    // Verify series belongs to project
    const { data: series } = await supabase
      .from('event_series').select('id').eq('id', seriesId).eq('project_id', project.id).single();
    if (!series) return NextResponse.json({ error: 'Series not found' }, { status: 404 });

    const count = await generateSeriesInstances(seriesId);

    return NextResponse.json({ success: true, instances_generated: count });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in POST series/generate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

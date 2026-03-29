import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id: personId } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
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

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'view');

    const { data: person } = await supabase
      .from('people')
      .select('id')
      .eq('id', personId)
      .eq('project_id', project.id)
      .maybeSingle();

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    // Get event IDs scoped to this project first, then filter registrations
    const { data: projectEvents } = await supabase
      .from('events')
      .select('id')
      .eq('project_id', project.id);

    const projectEventIds = (projectEvents ?? []).map((e) => e.id);

    if (projectEventIds.length === 0) {
      return NextResponse.json({ registrations: [] });
    }

    const { data: registrations, error } = await supabase
      .from('event_registrations')
      .select(`
        id,
        status,
        checked_in_at,
        created_at,
        event:events!inner(
          id,
          title,
          starts_at,
          ends_at,
          venue_name
        )
      `)
      .eq('person_id', personId)
      .in('event_id', projectEventIds)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ registrations: registrations ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/people/[id]/events:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';

interface RouteContext {
  params: Promise<{ slug: string; id: string; rid: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id, rid } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'view');

    const { data: event } = await supabase
      .from('events').select('id').eq('id', id).eq('project_id', project.id).single();
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const { data: registration } = await supabase
      .from('event_registrations').select('id').eq('id', rid).eq('event_id', id).single();
    if (!registration) return NextResponse.json({ error: 'Registration not found' }, { status: 404 });

    const { data: waivers, error } = await supabase
      .from('registration_waivers')
      .select(`
        id,
        signed_at,
        contract_document_id,
        event_waivers (
          id,
          template_id,
          contract_templates (
            id,
            name,
            description,
            file_name,
            category
          )
        ),
        contract_documents (
          id,
          status,
          completed_at,
          sent_at
        )
      `)
      .eq('registration_id', rid)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching registration waivers:', error);
      return NextResponse.json({ error: 'Failed to fetch registration waivers' }, { status: 500 });
    }

    return NextResponse.json({ waivers: waivers ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in GET /api/projects/[slug]/events/[id]/registrations/[rid]/waivers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

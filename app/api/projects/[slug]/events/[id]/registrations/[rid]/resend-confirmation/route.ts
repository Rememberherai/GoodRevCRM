import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { sendEventRegistrationConfirmation } from '@/lib/events/notifications';

interface RouteContext {
  params: Promise<{ slug: string; id: string; rid: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { slug, id, rid } = await context.params;
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

    const { data: registration } = await supabase
      .from('event_registrations')
      .select('id, status')
      .eq('id', rid)
      .eq('event_id', id)
      .single();
    if (!registration) return NextResponse.json({ error: 'Registration not found' }, { status: 404 });

    if (registration.status !== 'confirmed') {
      return NextResponse.json({ error: 'Can only resend confirmation for confirmed registrations' }, { status: 400 });
    }

    await sendEventRegistrationConfirmation(rid);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST resend-confirmation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { createServiceClient } from '@/lib/supabase/server';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { createWaiverForRegistration } from '@/lib/events/waivers';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

const addEventWaiverSchema = z.object({
  template_id: z.string().uuid(),
});

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
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

    const { data: waivers, error } = await supabase
      .from('event_waivers')
      .select('id, template_id, created_at, contract_templates ( id, name, file_name, description, category )')
      .eq('event_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching event waivers:', error);
      return NextResponse.json({ error: 'Failed to fetch waivers' }, { status: 500 });
    }

    return NextResponse.json({ waivers: waivers ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in GET /api/projects/[slug]/events/[id]/waivers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'create');

    const { data: event } = await supabase
      .from('events').select('id, title').eq('id', id).eq('project_id', project.id).single();
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const body = await request.json();
    const validation = addEventWaiverSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { data: template } = await supabase
      .from('contract_templates')
      .select('id, name')
      .eq('id', validation.data.template_id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();

    if (!template) {
      return NextResponse.json({ error: 'Contract template not found in this project' }, { status: 404 });
    }

    const { data: waiver, error } = await supabase
      .from('event_waivers')
      .insert({ event_id: id, template_id: validation.data.template_id })
      .select('id, template_id, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'This template is already linked to the event' }, { status: 409 });
      }
      console.error('Error creating event waiver:', error);
      return NextResponse.json({ error: 'Failed to add waiver' }, { status: 500 });
    }

    const { data: existingRegistrations, error: regFetchErr } = await supabase
      .from('event_registrations')
      .select('id, person_id, registrant_name, registrant_email, status')
      .eq('event_id', id)
      .neq('status', 'cancelled');
    if (regFetchErr) {
      console.error('[EVENT_WAIVERS] Failed to fetch existing registrations:', regFetchErr.message);
    }

    if (existingRegistrations && existingRegistrations.length > 0) {
      const serviceSupabase = createServiceClient();
      const trackingRows = existingRegistrations
        .filter((registration) => registration.status !== 'pending_waiver')
        .map((registration) => ({
          registration_id: registration.id,
          event_waiver_id: waiver.id,
        }));

      if (trackingRows.length > 0) {
        const { error: trackingError } = await supabase
          .from('registration_waivers')
          .insert(trackingRows);
        if (trackingError) {
          console.error('[EVENT_WAIVERS] Backfill registration_waivers failed:', trackingError);
        }
      }

      for (const registration of existingRegistrations.filter((item) => item.status === 'pending_waiver')) {
        const result = await createWaiverForRegistration({
          supabase: serviceSupabase,
          adminClient: serviceSupabase,
          projectId: project.id,
          eventId: id,
          eventTitle: event.title,
          registrationId: registration.id,
          personId: registration.person_id,
          registrantName: registration.registrant_name,
          registrantEmail: registration.registrant_email,
          createdBy: user.id,
          templateId: template.id,
          eventWaiverId: waiver.id,
        });

        if (!result.contractId) {
          const { error: upsertErr } = await supabase
            .from('registration_waivers')
            .upsert({
              registration_id: registration.id,
              event_waiver_id: waiver.id,
            }, {
              onConflict: 'registration_id,event_waiver_id',
            });
          if (upsertErr) {
            console.error('[EVENT_WAIVERS] Failed to upsert registration_waiver:', registration.id, upsertErr.message);
          }
        }
      }
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.created' as never,
      entityType: 'event_waiver' as never,
      entityId: waiver.id,
      data: { ...waiver, event_id: id, template_name: template.name },
    }).catch(err => console.error('Failed to emit automation event:', err));

    return NextResponse.json({ waiver }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in POST /api/projects/[slug]/events/[id]/waivers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'delete');

    const url = new URL(request.url);
    const waiverId = url.searchParams.get('waiverId');
    if (!waiverId) {
      return NextResponse.json({ error: 'waiverId query parameter is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('event_waivers')
      .delete()
      .eq('id', waiverId)
      .eq('event_id', id)
      .select('id')
      .single();

    if (error) {
      if (error.code === 'PGRST116') return NextResponse.json({ error: 'Waiver not found' }, { status: 404 });
      console.error('Error deleting event waiver:', error);
      return NextResponse.json({ error: 'Failed to remove waiver' }, { status: 500 });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.deleted' as never,
      entityType: 'event_waiver' as never,
      entityId: waiverId,
      data: { id: waiverId, event_id: id },
    }).catch(err => console.error('Failed to emit automation event:', err));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in DELETE /api/projects/[slug]/events/[id]/waivers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

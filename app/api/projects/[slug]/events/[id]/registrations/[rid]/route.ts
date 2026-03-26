import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { createServiceClient } from '@/lib/supabase/server';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { promoteFromWaitlist } from '@/lib/events/service';
import { sendWaitlistPromotionNotification, sendEventCancellationConfirmation } from '@/lib/events/notifications';
import { createWaiversForRegistration } from '@/lib/events/waivers';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ slug: string; id: string; rid: string }>;
}

const updateRegistrationSchema = z.object({
  status: z.enum(['pending_approval', 'pending_waiver', 'confirmed', 'waitlisted', 'cancelled']).optional(),
});

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

    // Verify event belongs to this project
    const { data: event } = await supabase
      .from('events').select('id').eq('id', id).eq('project_id', project.id).single();
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const { data: registration, error } = await supabase
      .from('event_registrations')
      .select('*, event_registration_tickets(*), registration_waivers(*, contract_documents(id, status, completed_at), event_waivers(id, template_id, contract_templates(id, name)))')
      .eq('id', rid)
      .eq('event_id', id)
      .single();

    if (error || !registration) return NextResponse.json({ error: 'Registration not found' }, { status: 404 });

    return NextResponse.json({ registration });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in GET registration:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id, rid } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'update');

    // Verify event belongs to this project
    const { data: eventCheck } = await supabase
      .from('events').select('id').eq('id', id).eq('project_id', project.id).single();
    if (!eventCheck) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const body = await request.json();
    const validationResult = updateRegistrationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Validation failed', details: validationResult.error.flatten() }, { status: 400 });
    }

    const { data: oldReg } = await supabase
      .from('event_registrations').select('status').eq('id', rid).eq('event_id', id).single();
    if (!oldReg) return NextResponse.json({ error: 'Registration not found' }, { status: 404 });

    const updates = validationResult.data;

    // Guard against empty update body
    if (!updates.status) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};

    if (updates.status) {
      updateData.status = updates.status;
    }

    const { data: registration, error } = await supabase
      .from('event_registrations')
      .update(updateData)
      .eq('id', rid)
      .eq('event_id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating registration:', error);
      return NextResponse.json({ error: 'Failed to update registration' }, { status: 500 });
    }

    if (updates.status === 'confirmed' && oldReg.status === 'waitlisted') {
      sendWaitlistPromotionNotification(rid).catch(err =>
        console.error('Failed to send waitlist promotion notification:', err)
      );
      emitAutomationEvent({
        projectId: project.id,
        triggerType: 'event.registration.confirmed',
        entityType: 'event_registration',
        entityId: rid,
        data: { event_id: id, status: 'confirmed', previous_status: 'waitlisted' },
      }).catch(err => console.error('Failed to emit confirmed automation event:', err));
    }

    // If cancelled, try to promote from waitlist
    if (updates.status === 'cancelled' && oldReg.status !== 'cancelled') {
      sendEventCancellationConfirmation(rid).catch(err =>
        console.error('Failed to send cancellation confirmation:', err)
      );
      const promotedId = await promoteFromWaitlist(id);
      if (promotedId) {
        sendWaitlistPromotionNotification(promotedId).catch(err =>
          console.error('Failed to send waitlist promotion notification:', err)
        );
      }
      emitAutomationEvent({
        projectId: project.id,
        triggerType: 'event.registration.cancelled',
        entityType: 'event_registration',
        entityId: rid,
        data: { event_id: id, status: 'cancelled', previous_status: oldReg.status },
      }).catch(err => console.error('Failed to emit cancelled automation event:', err));
    }

    if (updates.status === 'pending_waiver' && oldReg.status !== 'pending_waiver') {
      const [{ data: event }, { data: registration }] = await Promise.all([
        supabase
          .from('events')
          .select('id, project_id, title, created_by')
          .eq('id', id)
          .single(),
        supabase
          .from('event_registrations')
          .select('id, person_id, registrant_name, registrant_email')
          .eq('id', rid)
          .eq('event_id', id)
          .single(),
      ]);

      const createdBy = user.id || event?.created_by;
      if (event && registration && createdBy) {
        const serviceSupabase = createServiceClient();
        createWaiversForRegistration({
          supabase: serviceSupabase,
          adminClient: serviceSupabase,
          projectId: event.project_id,
          eventId: event.id,
          eventTitle: event.title,
          registrationId: registration.id,
          personId: registration.person_id,
          registrantName: registration.registrant_name,
          registrantEmail: registration.registrant_email,
          createdBy,
        }).catch((err) => console.error('Failed to create event waivers:', err));
      }
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.updated',
      entityType: 'event_registration',
      entityId: rid,
      data: registration as Record<string, unknown>,
      previousData: oldReg as Record<string, unknown>,
    }).catch(err => console.error('Failed to emit automation event:', err));

    return NextResponse.json({ registration });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in PATCH registration:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

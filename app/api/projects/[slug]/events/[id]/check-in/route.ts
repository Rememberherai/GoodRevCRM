import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { bridgeCheckInToAttendance } from '@/lib/events/service';
import { checkInSchema } from '@/lib/validators/event';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
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

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'update');

    const body = await request.json();
    const validationResult = checkInSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Validation failed', details: validationResult.error.flatten() }, { status: 400 });
    }

    // Verify event belongs to this project
    const { data: eventCheck } = await supabase
      .from('events').select('id').eq('id', id).eq('project_id', project.id).single();
    if (!eventCheck) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const { qr_code, registration_id, ticket_id } = validationResult.data;
    let ticketToCheckIn: { id: string; registration_id: string; checked_in_at: string | null } | null = null;

    if (qr_code) {
      const { data } = await supabase
        .from('event_registration_tickets')
        .select('id, registration_id, checked_in_at')
        .eq('qr_code', qr_code)
        .single();
      ticketToCheckIn = data;
    } else if (ticket_id) {
      const { data } = await supabase
        .from('event_registration_tickets')
        .select('id, registration_id, checked_in_at')
        .eq('id', ticket_id)
        .single();
      ticketToCheckIn = data;
    } else if (registration_id) {
      // Verify registration belongs to this event
      const { data: regCheck } = await supabase
        .from('event_registrations').select('id, status, registrant_name').eq('id', registration_id).eq('event_id', id).single();
      if (!regCheck) return NextResponse.json({ error: 'Registration not found for this event' }, { status: 404 });
      if (['cancelled', 'waitlisted'].includes(regCheck.status)) {
        return NextResponse.json({ error: `Cannot check in a ${regCheck.status} registration` }, { status: 409 });
      }

      // Check in all tickets for this registration
      const { data: tickets } = await supabase
        .from('event_registration_tickets')
        .select('id, registration_id')
        .eq('registration_id', registration_id)
        .is('checked_in_at', null);

      if (tickets && tickets.length > 0) {
        const now = new Date().toISOString();
        const { error: ticketErr } = await supabase
          .from('event_registration_tickets')
          .update({ checked_in_at: now })
          .eq('registration_id', registration_id)
          .is('checked_in_at', null);

        if (ticketErr) {
          console.error('Failed to check in tickets:', ticketErr.message);
          return NextResponse.json({ error: 'Failed to check in tickets' }, { status: 500 });
        }

        const { error: regErr } = await supabase
          .from('event_registrations')
          .update({ checked_in_at: now, checked_in_by: user.id })
          .eq('id', registration_id);

        if (regErr) {
          console.error('Failed to update registration check-in:', regErr.message);
        }

        // Bridge to program attendance
        const { data: reg } = await supabase
          .from('event_registrations')
          .select('person_id')
          .eq('id', registration_id)
          .single();

        if (reg?.person_id) {
          bridgeCheckInToAttendance(id, reg.person_id).catch(err =>
            console.error('Failed to bridge check-in to attendance:', err)
          );
        }

        emitAutomationEvent({
          projectId: project.id,
          triggerType: 'event.registration.checked_in',
          entityType: 'event_registration',
          entityId: registration_id,
          data: { event_id: id, tickets_checked_in: tickets.length },
        }).catch(err => console.error('Failed to emit automation event:', err));

        return NextResponse.json({
          success: true,
          tickets_checked_in: tickets.length,
          registration: {
            id: registration_id,
            registrant_name: regCheck.registrant_name,
            checked_in_at: now,
          },
        });
      }

      const { count: checkedInTicketCount } = await supabase
        .from('event_registration_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('registration_id', registration_id);

      if ((checkedInTicketCount ?? 0) > 0) {
        return NextResponse.json({ error: 'Registration has already been checked in' }, { status: 409 });
      }

      return NextResponse.json({ error: 'No tickets found for this registration' }, { status: 404 });
    }

    if (!ticketToCheckIn) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (ticketToCheckIn.checked_in_at) {
      return NextResponse.json({ error: 'Ticket has already been checked in' }, { status: 409 });
    }

    // Verify ticket belongs to this event
    const { data: reg } = await supabase
      .from('event_registrations')
      .select('id, event_id, person_id, status, registrant_name')
      .eq('id', ticketToCheckIn.registration_id)
      .single();

    if (!reg || reg.event_id !== id) {
      return NextResponse.json({ error: 'Ticket does not belong to this event' }, { status: 400 });
    }
    if (['cancelled', 'waitlisted'].includes(reg.status)) {
      return NextResponse.json({ error: `Cannot check in a ${reg.status} registration` }, { status: 409 });
    }

    const now = new Date().toISOString();
    const { error: ticketUpdateErr } = await supabase
      .from('event_registration_tickets')
      .update({ checked_in_at: now })
      .eq('id', ticketToCheckIn.id);

    if (ticketUpdateErr) {
      console.error('Failed to check in ticket:', ticketUpdateErr.message);
      return NextResponse.json({ error: 'Failed to check in ticket' }, { status: 500 });
    }

    const { error: regUpdateErr } = await supabase
      .from('event_registrations')
      .update({ checked_in_at: now, checked_in_by: user.id })
      .eq('id', ticketToCheckIn.registration_id);

    if (regUpdateErr) {
      console.error('Failed to update registration check-in:', regUpdateErr.message);
    }

    if (reg.person_id) {
      bridgeCheckInToAttendance(id, reg.person_id).catch(err =>
        console.error('Failed to bridge check-in to attendance:', err)
      );
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'event.registration.checked_in',
      entityType: 'event_registration',
      entityId: ticketToCheckIn.registration_id,
      data: { event_id: id, ticket_id: ticketToCheckIn.id },
    }).catch(err => console.error('Failed to emit automation event:', err));

    return NextResponse.json({
      success: true,
      ticket_id: ticketToCheckIn.id,
      registration: {
        id: ticketToCheckIn.registration_id,
        registrant_name: reg.registrant_name,
        checked_in_at: now,
      },
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in POST check-in:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

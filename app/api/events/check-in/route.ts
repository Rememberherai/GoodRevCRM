import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { bridgeCheckInToAttendance } from '@/lib/events/service';
import { z } from 'zod';

const checkInSchema = z.object({
  qr_code: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    // Require authenticated user
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();

    const body = await request.json();
    const validationResult = checkInSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { qr_code } = validationResult.data;

    // Look up ticket by QR code
    const { data: ticket } = await supabase
      .from('event_registration_tickets')
      .select('id, registration_id, checked_in_at')
      .eq('qr_code', qr_code)
      .single();

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (ticket.checked_in_at) {
      return NextResponse.json({ error: 'Ticket has already been checked in' }, { status: 409 });
    }

    // Get registration details
    const { data: reg } = await supabase
      .from('event_registrations')
      .select('id, event_id, person_id, status, registrant_name, events(project_id)')
      .eq('id', ticket.registration_id)
      .single();

    if (!reg) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    // Verify user is a member of the event's project
    const projectId = (reg.events as unknown as { project_id: string })?.project_id;
    if (!projectId) {
      return NextResponse.json({ error: 'Event project not found' }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from('project_memberships')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'You do not have permission to check in attendees for this event' }, { status: 403 });
    }

    if (['cancelled', 'waitlisted'].includes(reg.status)) {
      return NextResponse.json({ error: `Cannot check in a ${reg.status} registration` }, { status: 409 });
    }

    // Check in the ticket
    const now = new Date().toISOString();
    const { error: ticketUpdateErr } = await supabase
      .from('event_registration_tickets')
      .update({ checked_in_at: now })
      .eq('id', ticket.id);

    if (ticketUpdateErr) {
      console.error('Failed to check in ticket:', ticketUpdateErr.message);
      return NextResponse.json({ error: 'Failed to check in ticket' }, { status: 500 });
    }

    // Update registration check-in timestamp
    const { error: regUpdateErr } = await supabase
      .from('event_registrations')
      .update({ checked_in_at: now })
      .eq('id', ticket.registration_id);

    if (regUpdateErr) {
      console.error('Failed to update registration check-in:', regUpdateErr.message);
    }

    // Bridge to program attendance (fire-and-forget)
    if (reg.person_id) {
      bridgeCheckInToAttendance(reg.event_id, reg.person_id).catch(err =>
        console.error('Failed to bridge check-in to attendance:', err)
      );
    }

    // Emit automation event (fire-and-forget)
    if (projectId) {
      emitAutomationEvent({
        projectId,
        triggerType: 'event.registration.checked_in',
        entityType: 'event_registration',
        entityId: ticket.registration_id,
        data: { event_id: reg.event_id, ticket_id: ticket.id },
      }).catch(err => console.error('Failed to emit automation event:', err));
    }

    return NextResponse.json({
      success: true,
      ticket_id: ticket.id,
      registration: {
        id: ticket.registration_id,
        registrant_name: reg.registrant_name,
        checked_in_at: now,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/events/check-in:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { bridgeCheckInToAttendance } from '@/lib/events/service';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

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

    // Verify event belongs to this project
    const { data: eventCheck } = await supabase
      .from('events').select('id').eq('id', id).eq('project_id', project.id).single();
    if (!eventCheck) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const { data: registrations, error } = await supabase
      .from('event_registrations')
      .select('id, registrant_name, registrant_email, status, checked_in_at, checked_in_by, person_id')
      .eq('event_id', id)
      .in('status', ['confirmed', 'pending_approval', 'pending_waiver'])
      .order('registrant_name', { ascending: true })
      .limit(1000);

    if (error) {
      console.error('Error fetching attendance:', error);
      return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 });
    }

    return NextResponse.json({ attendees: registrations });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in GET attendance:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const batchAttendanceSchema = z.object({
  attendees: z.array(z.object({
    registration_id: z.string().uuid(),
    status: z.enum(['present', 'absent', 'excused']),
  })).min(1),
});

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

    // Verify event belongs to this project
    const { data: eventCheck } = await supabase
      .from('events').select('id').eq('id', id).eq('project_id', project.id).single();
    if (!eventCheck) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const body = await request.json();
    const validationResult = batchAttendanceSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Validation failed', details: validationResult.error.flatten() }, { status: 400 });
    }

    const { attendees } = validationResult.data;
    const now = new Date().toISOString();
    let updated = 0;

    for (const attendee of attendees) {
      if (attendee.status === 'present') {
        const { error } = await supabase
          .from('event_registrations')
          .update({ checked_in_at: now, checked_in_by: user.id })
          .eq('id', attendee.registration_id)
          .eq('event_id', id);

        if (!error) {
          const { error: ticketErr } = await supabase
            .from('event_registration_tickets')
            .update({ checked_in_at: now })
            .eq('registration_id', attendee.registration_id);

          if (ticketErr) {
            console.error('Failed to update ticket check-in:', ticketErr.message);
          }

          updated++;
          // Bridge to program attendance
          const { data: reg, error: regErr } = await supabase
            .from('event_registrations')
            .select('person_id')
            .eq('id', attendee.registration_id)
            .eq('event_id', id)
            .single();

          if (regErr) {
            console.error('Failed to fetch registration for attendance bridge:', regErr.message);
          }

          if (reg?.person_id) {
            bridgeCheckInToAttendance(id, reg.person_id).catch(err =>
              console.error('Failed to bridge attendance:', err)
            );
          }
        }
      } else {
        // Absent or excused — clear checked_in_at
        const { error } = await supabase
          .from('event_registrations')
          .update({ checked_in_at: null, checked_in_by: null })
          .eq('id', attendee.registration_id)
          .eq('event_id', id);

        if (!error) {
          const { error: ticketClearErr } = await supabase
            .from('event_registration_tickets')
            .update({ checked_in_at: null })
            .eq('registration_id', attendee.registration_id);

          if (ticketClearErr) {
            console.error('Failed to clear ticket check-in:', ticketClearErr.message);
          }
          updated++;
        }
      }
    }

    return NextResponse.json({ success: true, updated });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in POST attendance:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

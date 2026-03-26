/**
 * Event service — business logic for event registration side effects.
 *
 * All functions create their own service clients internally (matching calendar service pattern).
 * Fire-and-forget safe: errors logged, never thrown to caller.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { createWaiversForEnrollment } from '@/lib/community/waivers';
import { createWaiversForRegistration } from '@/lib/events/waivers';

// ============================================================
// Waitlist promotion
// ============================================================

/**
 * Promote the oldest waitlisted registration to confirmed.
 * Called after a cancellation frees up capacity.
 * Returns the promoted registration ID or null.
 */
export async function promoteFromWaitlist(eventId: string): Promise<string | null> {
  const supabase = createServiceClient();

  try {
    // Check if there's remaining capacity before promoting
    const capacity = await getEventCapacityStatus(eventId);
    if (capacity.total !== null && capacity.remaining !== null && capacity.remaining <= 0) {
      return null; // No capacity — don't promote
    }

    // Find oldest waitlisted registration
    const { data: waitlisted } = await supabase
      .from('event_registrations')
      .select('id')
      .eq('event_id', eventId)
      .eq('status', 'waitlisted')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!waitlisted) return null;

    const { data: event } = await supabase
      .from('events')
      .select('project_id, title, requires_waiver, created_by')
      .eq('id', eventId)
      .maybeSingle();

    const nextStatus = event?.requires_waiver ? 'pending_waiver' : 'confirmed';

    // Promote the registration using the same waiver-aware states as public registration.
    // Include .eq('status', 'waitlisted') to prevent race conditions where two concurrent
    // calls could promote the same registration — only the first will match.
    const { data: promoted, error } = await supabase
      .from('event_registrations')
      .update({ status: nextStatus })
      .eq('id', waitlisted.id)
      .eq('status', 'waitlisted')
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('Failed to promote from waitlist:', error.message);
      return null;
    }

    // If no row was updated, another concurrent call already promoted this registration
    if (!promoted) return null;

    if (nextStatus === 'pending_waiver' && event) {
      const { data: registration } = await supabase
        .from('event_registrations')
        .select('id, person_id, registrant_name, registrant_email')
        .eq('id', waitlisted.id)
        .single();

      if (registration) {
        const { data: memberships } = await supabase
          .from('project_memberships')
          .select('user_id, role')
          .eq('project_id', event.project_id)
          .in('role', ['owner', 'admin']);

        const ownerOrAdmin = (memberships ?? []).sort((a, b) => {
          const priority: Record<string, number> = { owner: 0, admin: 1 };
          return (priority[a.role] ?? 99) - (priority[b.role] ?? 99);
        })[0];

        const createdBy = ownerOrAdmin?.user_id ?? event.created_by;
        if (createdBy) {
          createWaiversForRegistration({
            supabase,
            adminClient: supabase,
            projectId: event.project_id,
            eventId,
            eventTitle: event.title,
            registrationId: registration.id,
            personId: registration.person_id,
            registrantName: registration.registrant_name,
            registrantEmail: registration.registrant_email,
            createdBy,
          }).catch((waiverError) => {
            console.error('Failed to create event waivers after waitlist promotion:', waiverError);
          });
        }
      }
    }

    return waitlisted.id;
  } catch (err) {
    console.error('promoteFromWaitlist error:', err);
    return null;
  }
}

// ============================================================
// Capacity status
// ============================================================

interface CapacityStatus {
  total: number | null;
  registered: number;
  remaining: number | null;
  waitlisted: number;
}

/**
 * Get current capacity status for an event.
 * Counts tickets (not registrations) matching the RPC capacity check logic.
 */
export async function getEventCapacityStatus(eventId: string): Promise<CapacityStatus> {
  const supabase = createServiceClient();

  const eventResult = await supabase
    .from('events')
    .select('total_capacity')
    .eq('id', eventId)
    .single();

  // Count tickets (not registrations) for both registered and waitlisted — consistent basis
  const [registeredResult, waitlistedResult] = await Promise.all([
    supabase
      .from('event_registration_tickets')
      .select('id, event_registrations!inner(id, event_id, status)', { count: 'exact', head: true })
      .eq('event_registrations.event_id', eventId)
      .in('event_registrations.status', ['confirmed', 'pending_approval', 'pending_waiver']),
    supabase
      .from('event_registration_tickets')
      .select('id, event_registrations!inner(id, event_id, status)', { count: 'exact', head: true })
      .eq('event_registrations.event_id', eventId)
      .eq('event_registrations.status', 'waitlisted'),
  ]);

  const total = eventResult.data?.total_capacity ?? null;
  const registered = registeredResult.count ?? 0;
  const waitlisted = waitlistedResult.count ?? 0;

  return {
    total,
    registered,
    remaining: total !== null ? Math.max(0, total - registered) : null,
    waitlisted,
  };
}

// ============================================================
// Program enrollment bridge
// ============================================================

/**
 * Auto-enroll a person in a program linked to an event.
 * Skips if enrollment already exists (no unique constraint on person_id,program_id).
 * Fire-and-forget safe.
 */
export async function autoEnrollInProgram(
  personId: string,
  programId: string,
  projectId: string
): Promise<void> {
  const supabase = createServiceClient();

  try {
    // Check if enrollment already exists
    const { data: existing } = await supabase
      .from('program_enrollments')
      .select('id')
      .eq('person_id', personId)
      .eq('program_id', programId)
      .limit(1)
      .maybeSingle();

    if (existing) return; // Already enrolled

    // Check if program requires waiver
    const { data: program } = await supabase
      .from('programs')
      .select('name, requires_waiver')
      .eq('id', programId)
      .single();

    const waiverStatus = program?.requires_waiver ? 'pending' : 'not_required';
    const enrollmentStatus = program?.requires_waiver ? 'waitlisted' : 'active';

    const { data: memberships } = await supabase
      .from('project_memberships')
      .select('user_id, role')
      .eq('project_id', projectId)
      .in('role', ['owner', 'admin']);

    const ownerOrAdmin = (memberships ?? []).sort((a, b) => {
      const priority: Record<string, number> = { owner: 0, admin: 1 };
      return (priority[a.role] ?? 99) - (priority[b.role] ?? 99);
    })[0];

    const { data: enrollment, error } = await supabase
      .from('program_enrollments')
      .insert({
        program_id: programId,
        person_id: personId,
        status: enrollmentStatus,
        waiver_status: waiverStatus,
        enrolled_at: new Date().toISOString(),
        notes: program?.requires_waiver ? 'Awaiting signed waiver' : null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('autoEnrollInProgram error:', error.message);
      return;
    }

    // Emit automation event
    const { emitAutomationEvent } = await import('@/lib/automations/engine');
    emitAutomationEvent({
      projectId,
      triggerType: 'entity.created',
      entityType: 'program_enrollment',
      entityId: enrollment?.id ?? '',
      data: { program_id: programId, person_id: personId },
    }).catch((err) => console.error('Failed to emit enrollment event:', err));

    if (program?.requires_waiver && enrollment?.id && ownerOrAdmin?.user_id) {
      createWaiversForEnrollment({
        supabase,
        adminClient: supabase,
        projectId,
        programId,
        programName: program.name ?? 'Program',
        enrollmentId: enrollment.id,
        personId,
        createdBy: ownerOrAdmin.user_id,
      }).catch((err) => console.error('Failed to create enrollment waivers:', err));
    }
  } catch (err) {
    console.error('autoEnrollInProgram error:', err);
  }
}

// ============================================================
// Check-in to program attendance bridge
// ============================================================

/**
 * When a registrant is checked in at an event linked to a program,
 * create/update a program_attendance row.
 * Fire-and-forget safe.
 */
export async function bridgeCheckInToAttendance(
  eventId: string,
  personId: string
): Promise<void> {
  const supabase = createServiceClient();

  try {
    // Get event to check if it's linked to a program
    const { data: event } = await supabase
      .from('events')
      .select('program_id, starts_at, timezone')
      .eq('id', eventId)
      .single();

    if (!event?.program_id || !event.starts_at) return;

    // Extract date from starts_at in the event's timezone (not UTC)
    // Use Intl.DateTimeFormat to get the local date in the event timezone
    const eventDate = new Date(event.starts_at);
    const tz = event.timezone || 'America/Denver';
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    const date = formatter.format(eventDate); // YYYY-MM-DD in event timezone

    // Upsert program_attendance
    const { error } = await supabase
      .from('program_attendance')
      .upsert({
        program_id: event.program_id,
        person_id: personId,
        date,
        status: 'present',
        hours: 0,
      }, { onConflict: 'program_id,person_id,date' });

    if (error) {
      console.error('bridgeCheckInToAttendance error:', error.message);
    }
  } catch (err) {
    console.error('bridgeCheckInToAttendance error:', err);
  }
}

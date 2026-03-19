/**
 * Calendar CRM Bridge — links bookings to CRM entities (contacts, meetings, activities).
 *
 * All functions are fire-and-forget safe: they catch and log errors, never throw.
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// ============================================================
// Helpers
// ============================================================

const FREE_EMAIL_PROVIDERS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com', 'yandex.com',
  'live.com', 'msn.com', 'me.com', 'mac.com', 'comcast.net',
];

function extractDomain(email: string): string | null {
  const parts = email.split('@');
  if (parts.length !== 2 || !parts[1]) return null;
  const domain = parts[1].toLowerCase();
  if (FREE_EMAIL_PROVIDERS.includes(domain)) return null;
  return domain;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) {
    return { firstName: trimmed || 'Unknown', lastName: '' };
  }
  return {
    firstName: trimmed.slice(0, spaceIdx),
    lastName: trimmed.slice(spaceIdx + 1).trim(),
  };
}

// ============================================================
// matchOrCreateContact
// ============================================================

interface ContactMatch {
  personId: string | null;
  organizationId: string | null;
}

type ServiceClient = SupabaseClient<Database>;

export async function matchOrCreateContact(
  email: string,
  name: string,
  phone: string | null,
  projectId: string,
  hostUserId: string,
  supabase: ServiceClient
): Promise<ContactMatch> {
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Try to match existing person by email
  const { data: people } = await supabase
    .from('people')
    .select('id, project_id')
    .ilike('email', normalizedEmail)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .limit(1);

  const person = people?.[0];
  if (person) {
    // Look up their primary org
    const { data: personOrgs } = await supabase
      .from('person_organizations')
      .select('organization_id')
      .eq('person_id', person.id)
      .eq('is_current', true)
      .order('is_primary', { ascending: false })
      .limit(1);

    return {
      personId: person.id,
      organizationId: personOrgs?.[0]?.organization_id ?? null,
    };
  }

  // 2. No existing person — auto-create
  const { firstName, lastName } = splitName(name);
  let organizationId: string | null = null;

  // Try domain-matching for org
  const domain = extractDomain(normalizedEmail);
  if (domain) {
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id')
      .ilike('domain', domain)
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(1);

    organizationId = orgs?.[0]?.id ?? null;
  }

  const { data: newPerson, error: insertError } = await supabase
    .from('people')
    .insert({
      first_name: firstName,
      last_name: lastName || '(unknown)',
      email: normalizedEmail,
      phone: phone || null,
      project_id: projectId,
      created_by: hostUserId,
    })
    .select('id')
    .single();

  if (insertError || !newPerson) {
    console.error('CRM bridge: failed to create person:', insertError?.message);
    return { personId: null, organizationId };
  }

  // Link person to org if we found one
  if (organizationId) {
    await supabase
      .from('person_organizations')
      .insert({
        person_id: newPerson.id,
        organization_id: organizationId,
        project_id: projectId,
        is_primary: true,
        is_current: true,
      });
  }

  return { personId: newPerson.id, organizationId };
}

// ============================================================
// createCrmMeeting
// ============================================================

interface BookingForMeeting {
  id: string;
  start_at: string;
  end_at: string;
  invitee_name: string;
  location: string | null;
  meeting_url: string | null;
  project_id: string;
  host_user_id: string;
}

interface EventTypeForMeeting {
  title: string;
  duration_minutes: number;
  default_meeting_type: string | null;
}

export async function createCrmMeeting(
  booking: BookingForMeeting,
  eventType: EventTypeForMeeting,
  personId: string | null,
  orgId: string | null,
  supabase: ServiceClient
): Promise<string | null> {
  const title = `${eventType.title} with ${booking.invitee_name}`;

  const { data: meeting, error } = await supabase
    .from('meetings')
    .insert({
      title,
      meeting_type: eventType.default_meeting_type || 'video_call',
      scheduled_at: booking.start_at,
      duration_minutes: eventType.duration_minutes,
      status: 'scheduled',
      location: booking.location,
      meeting_url: booking.meeting_url,
      person_id: personId,
      organization_id: orgId,
      project_id: booking.project_id,
      created_by: booking.host_user_id,
      assigned_to: booking.host_user_id,
    })
    .select('id')
    .single();

  if (error || !meeting) {
    console.error('CRM bridge: failed to create meeting:', error?.message);
    return null;
  }

  // Add person as attendee
  if (personId) {
    await supabase
      .from('meeting_attendees')
      .insert({
        meeting_id: meeting.id,
        person_id: personId,
      });
  }

  return meeting.id;
}

// ============================================================
// logBookingActivity
// ============================================================

interface BookingForActivity {
  id: string;
  project_id: string;
  host_user_id: string;
  invitee_name: string;
}

export async function logBookingActivity(
  booking: BookingForActivity,
  personId: string | null,
  orgId: string | null,
  eventTitle: string,
  supabase: ServiceClient
): Promise<void> {
  const { error } = await supabase
    .from('activity_log')
    .insert({
      action: 'created',
      activity_type: 'meeting',
      outcome: 'meeting_booked',
      subject: eventTitle,
      entity_type: 'booking',
      entity_id: booking.id,
      project_id: booking.project_id,
      person_id: personId,
      organization_id: orgId,
      user_id: booking.host_user_id,
      notes: `Booking created for ${booking.invitee_name}`,
    });

  if (error) {
    console.error('CRM bridge: failed to log activity:', error.message);
  }
}

// ============================================================
// linkBookingToCrm (top-level orchestrator)
// ============================================================

export async function linkBookingToCrm(bookingId: string): Promise<void> {
  try {
    const supabase = createServiceClient();

    // Load booking with event type
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, event_types(*)')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('CRM bridge: booking not found:', bookingError?.message);
      return;
    }

    const eventType = booking.event_types;
    if (!eventType) {
      console.error('CRM bridge: event type not found for booking:', bookingId);
      return;
    }

    // Guard against duplicate CRM linking — if booking already has a meeting_id, skip
    if (booking.meeting_id) {
      console.log('CRM bridge: booking already linked to meeting:', booking.meeting_id);
      return;
    }

    // Match or create contact
    const { personId, organizationId } = await matchOrCreateContact(
      booking.invitee_email,
      booking.invitee_name,
      booking.invitee_phone,
      booking.project_id,
      booking.host_user_id,
      supabase
    );

    // Create CRM meeting
    const meetingId = await createCrmMeeting(
      booking,
      eventType,
      personId,
      organizationId,
      supabase
    );

    // Log activity
    await logBookingActivity(
      booking,
      personId,
      organizationId,
      eventType.title,
      supabase
    );

    // Update booking with CRM links
    const updates: Record<string, string | null> = {};
    if (personId) updates.person_id = personId;
    if (organizationId) updates.organization_id = organizationId;
    if (meetingId) updates.meeting_id = meetingId;

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('bookings')
        .update(updates)
        .eq('id', bookingId);
    }
  } catch (err) {
    console.error('CRM bridge: linkBookingToCrm failed:', err);
  }
}

// ============================================================
// syncBookingStatusToMeeting
// ============================================================

const BOOKING_TO_MEETING_STATUS: Record<string, string> = {
  cancelled: 'cancelled',
  completed: 'completed',
  no_show: 'no_show',
  rescheduled: 'cancelled',
};

export async function syncBookingStatusToMeeting(
  bookingId: string,
  newStatus: string
): Promise<void> {
  try {
    const supabase = createServiceClient();

    const { data: booking } = await supabase
      .from('bookings')
      .select('meeting_id')
      .eq('id', bookingId)
      .single();

    if (!booking?.meeting_id) return;

    const meetingStatus = BOOKING_TO_MEETING_STATUS[newStatus];
    if (!meetingStatus) return;

    const updatePayload: Record<string, string> = { status: meetingStatus };
    if (newStatus === 'rescheduled') {
      updatePayload.cancellation_reason = 'Rescheduled by invitee';
    }

    await supabase
      .from('meetings')
      .update(updatePayload)
      .eq('id', booking.meeting_id);
  } catch (err) {
    console.error('CRM bridge: syncBookingStatusToMeeting failed:', err);
  }
}

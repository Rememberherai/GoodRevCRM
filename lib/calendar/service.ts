/**
 * Calendar service — booking business logic (create, cancel, reschedule).
 *
 * All booking mutations go through this service to ensure:
 * - Anti-overbooking via the create_booking_if_available RPC
 * - Consistent buffer handling
 * - Rate limiting
 * - Notification dispatch
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import { sendBookingConfirmation, sendBookingCancellation, sendBookingConfirmedNotification } from './notifications';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { linkBookingToCrm, syncBookingStatusToMeeting } from '@/lib/calendar/crm-bridge';
import { pushBookingToCalendar, pushBookingToTeamCalendars, removeBookingFromCalendar } from '@/lib/calendar/sync';

// ============================================================
// Rate limiting
// ============================================================

interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
}

export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMinutes: number
): Promise<RateLimitResult> {
  const supabase = createServiceClient();

  // Truncate to window boundary
  const now = new Date();
  const windowMs = windowMinutes * 60 * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);

  // Use raw SQL via rpc to do INSERT ... ON CONFLICT ... DO UPDATE atomically
  const { data, error } = await supabase.rpc('upsert_rate_limit', {
    p_key: key,
    p_window_start: windowStart.toISOString(),
  });

  if (error) {
    // Fallback: allow on error (don't block users due to rate limit bugs)
    console.error('Rate limit check failed:', error.message);
    return { allowed: true };
  }

  const count = (data as number) ?? 1;
  if (count > maxAttempts) {
    const retryAfterMs = windowStart.getTime() + windowMs - now.getTime();
    return { allowed: false, retryAfterMs };
  }

  return { allowed: true };
}

// ============================================================
// Booking creation
// ============================================================

interface CreateBookingInput {
  eventTypeId: string;
  startAt: string; // ISO datetime
  inviteeName: string;
  inviteeEmail: string;
  inviteePhone?: string | null;
  inviteeTimezone?: string | null;
  inviteeNotes?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
  responses?: Record<string, unknown>;
  excludeBookingId?: string | null;
}

interface CreateBookingResult {
  success: boolean;
  bookingId?: string;
  error?: string;
  errorCode?: 'SLOT_TAKEN' | 'DAILY_LIMIT' | 'WEEKLY_LIMIT' | 'EVENT_TYPE_NOT_FOUND' | 'RATE_LIMITED';
}

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const supabase = createServiceClient();

  // Load event type
  const { data: eventType, error: etError } = await supabase
    .from('event_types')
    .select('*')
    .eq('id', input.eventTypeId)
    .eq('is_active', true)
    .single();

  if (etError || !eventType) {
    return { success: false, error: 'Event type not found', errorCode: 'EVENT_TYPE_NOT_FOUND' };
  }

  // Get host timezone from schedule or profile
  let hostTimezone = 'America/New_York';
  if (eventType.schedule_id) {
    const { data: schedule } = await supabase
      .from('availability_schedules')
      .select('timezone')
      .eq('id', eventType.schedule_id)
      .single();
    if (schedule) hostTimezone = schedule.timezone;
  } else {
    const { data: profile } = await supabase
      .from('calendar_profiles')
      .select('timezone')
      .eq('user_id', eventType.user_id)
      .single();
    if (profile) hostTimezone = profile.timezone;
  }

  // Calculate end time
  const startAt = new Date(input.startAt);
  const endAt = new Date(startAt.getTime() + eventType.duration_minutes * 60 * 1000);
  const bufferBefore = `${eventType.buffer_before_minutes || 0} minutes`;
  const bufferAfter = `${eventType.buffer_after_minutes || 0} minutes`;
  const schedulingType = eventType.scheduling_type || 'one_on_one';

  let newBookingId: string;
  let assignedUserId: string | null = null;
  let teamMemberIds: string[] = [];

  if (schedulingType === 'round_robin') {
    // Load active team members
    const { data: members } = await supabase
      .from('event_type_members')
      .select('user_id')
      .eq('event_type_id', eventType.id)
      .eq('is_active', true);

    const candidateIds = members && members.length > 0
      ? members.map((m) => m.user_id)
      : [eventType.user_id];

    const { data: rrResult, error: rrError } = await supabase.rpc(
      'create_round_robin_booking',
      {
        p_event_type_id: eventType.id,
        p_project_id: eventType.project_id,
        p_candidate_user_ids: candidateIds,
        p_start_at: startAt.toISOString(),
        p_end_at: endAt.toISOString(),
        p_buffer_before: bufferBefore,
        p_buffer_after: bufferAfter,
        p_host_timezone: hostTimezone,
        p_daily_limit: eventType.daily_limit ?? null,
        p_weekly_limit: eventType.weekly_limit ?? null,
        p_invitee_name: input.inviteeName,
        p_invitee_email: input.inviteeEmail,
        p_invitee_phone: input.inviteePhone ?? null,
        p_invitee_timezone: input.inviteeTimezone ?? null,
        p_invitee_notes: input.inviteeNotes ?? null,
        p_location: input.location ?? eventType.location_value ?? null,
        p_meeting_url: input.meetingUrl ?? null,
        p_responses: input.responses ?? {},
        p_requires_confirmation: eventType.requires_confirmation ?? false,
      } as unknown as Database['public']['Functions']['create_round_robin_booking']['Args']
    );

    if (rrError) {
      return handleRpcError(rrError);
    }

    // RPC returns a table with booking_id and assigned_user_id
    const resultRow = Array.isArray(rrResult) ? rrResult[0] : rrResult;
    if (!resultRow?.booking_id) {
      return { success: false, error: 'Booking creation returned no ID' };
    }

    newBookingId = resultRow.booking_id as string;
    assignedUserId = resultRow.assigned_user_id as string;
  } else if (schedulingType === 'collective') {
    // Load active team members
    const { data: members } = await supabase
      .from('event_type_members')
      .select('user_id')
      .eq('event_type_id', eventType.id)
      .eq('is_active', true);

    teamMemberIds = members && members.length > 0
      ? members.map((m) => m.user_id)
      : [eventType.user_id];

    const { data: collectiveId, error: collectiveError } = await supabase.rpc(
      'create_collective_booking',
      {
        p_event_type_id: eventType.id,
        p_host_user_id: eventType.user_id,
        p_member_user_ids: teamMemberIds,
        p_project_id: eventType.project_id,
        p_start_at: startAt.toISOString(),
        p_end_at: endAt.toISOString(),
        p_buffer_before: bufferBefore,
        p_buffer_after: bufferAfter,
        p_host_timezone: hostTimezone,
        p_daily_limit: eventType.daily_limit ?? null,
        p_weekly_limit: eventType.weekly_limit ?? null,
        p_invitee_name: input.inviteeName,
        p_invitee_email: input.inviteeEmail,
        p_invitee_phone: input.inviteePhone ?? null,
        p_invitee_timezone: input.inviteeTimezone ?? null,
        p_invitee_notes: input.inviteeNotes ?? null,
        p_location: input.location ?? eventType.location_value ?? null,
        p_meeting_url: input.meetingUrl ?? null,
        p_responses: input.responses ?? {},
        p_requires_confirmation: eventType.requires_confirmation ?? false,
      } as unknown as Database['public']['Functions']['create_collective_booking']['Args']
    );

    if (collectiveError) {
      return handleRpcError(collectiveError);
    }

    if (!collectiveId) {
      return { success: false, error: 'Booking creation returned no ID' };
    }

    newBookingId = collectiveId as string;
  } else {
    // one_on_one / group — standard flow
    const rpcArgs = {
      p_event_type_id: eventType.id,
      p_host_user_id: eventType.user_id,
      p_project_id: eventType.project_id,
      p_start_at: startAt.toISOString(),
      p_end_at: endAt.toISOString(),
      p_buffer_before: bufferBefore,
      p_buffer_after: bufferAfter,
      p_host_timezone: hostTimezone,
      p_daily_limit: eventType.daily_limit ?? null,
      p_weekly_limit: eventType.weekly_limit ?? null,
      p_invitee_name: input.inviteeName,
      p_invitee_email: input.inviteeEmail,
      p_invitee_phone: input.inviteePhone ?? null,
      p_invitee_timezone: input.inviteeTimezone ?? null,
      p_invitee_notes: input.inviteeNotes ?? null,
      p_location: input.location ?? eventType.location_value ?? null,
      p_meeting_url: input.meetingUrl ?? null,
      p_responses: input.responses ?? {},
      p_requires_confirmation: eventType.requires_confirmation ?? false,
      p_exclude_booking_id: input.excludeBookingId ?? null,
    } as unknown as Database['public']['Functions']['create_booking_if_available']['Args'];

    const { data: bookingId, error: rpcError } = await supabase.rpc(
      'create_booking_if_available',
      rpcArgs
    );

    if (rpcError) {
      return handleRpcError(rpcError);
    }

    if (!bookingId) {
      return { success: false, error: 'Booking creation returned no ID' };
    }

    newBookingId = bookingId as string;
  }

  // Send confirmation email (fire-and-forget)
  sendBookingConfirmation(newBookingId).catch((err) =>
    console.error('Failed to send booking confirmation:', err)
  );

  // Emit automation event (fire-and-forget)
  emitAutomationEvent({
    projectId: eventType.project_id,
    triggerType: 'booking.created',
    entityType: 'booking',
    entityId: newBookingId,
    data: { booking_id: newBookingId, assigned_user_id: assignedUserId },
  }).catch((err) => console.error('Failed to emit booking.created event:', err));

  // Link booking to CRM entities only if not pending confirmation
  if (!eventType.requires_confirmation) {
    linkBookingToCrm(newBookingId).catch((e: unknown) =>
      console.error('Failed to link booking to CRM:', e)
    );

    // Push to Google Calendar (fire-and-forget)
    if (schedulingType === 'collective' && teamMemberIds.length > 0) {
      // Push to all team members' calendars
      pushBookingToTeamCalendars(newBookingId, teamMemberIds).catch((e: unknown) =>
        console.error('Failed to push booking to team calendars:', e)
      );
    } else {
      pushBookingToCalendar(newBookingId).catch((e: unknown) =>
        console.error('Failed to push booking to Google Calendar:', e)
      );
    }
  }

  return { success: true, bookingId: newBookingId };
}

// ============================================================
// Confirm booking (host confirms a pending booking)
// ============================================================

export async function confirmBooking(
  bookingId: string,
  hostUserId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  // Load and verify booking
  const { data: booking, error: loadError } = await supabase
    .from('bookings')
    .select('id, status, host_user_id, project_id')
    .eq('id', bookingId)
    .single();

  if (loadError || !booking) {
    return { success: false, error: 'Booking not found' };
  }

  if (booking.host_user_id !== hostUserId) {
    return { success: false, error: 'Not authorized to confirm this booking' };
  }

  if (booking.status !== 'pending') {
    return { success: false, error: `Booking cannot be confirmed from status "${booking.status}"` };
  }

  // Update status
  const { error: updateError } = await supabase
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', bookingId);

  if (updateError) {
    return { success: false, error: 'Failed to update booking status' };
  }

  // Send confirmed notification to invitee (fire-and-forget)
  sendBookingConfirmedNotification(bookingId).catch((err) =>
    console.error('Failed to send booking confirmed notification:', err)
  );

  // Emit automation event (fire-and-forget)
  emitAutomationEvent({
    projectId: booking.project_id,
    triggerType: 'booking.confirmed',
    entityType: 'booking',
    entityId: bookingId,
    data: { booking_id: bookingId },
  }).catch((err) => console.error('Failed to emit booking.confirmed event:', err));

  // Link booking to CRM (fire-and-forget)
  linkBookingToCrm(bookingId).catch((e: unknown) =>
    console.error('Failed to link booking to CRM:', e)
  );

  // Push to Google Calendar (fire-and-forget)
  pushBookingToCalendar(bookingId).catch((e: unknown) =>
    console.error('Failed to push booking to Google Calendar:', e)
  );

  return { success: true };
}

// ============================================================
// Cancel booking
// ============================================================

interface CancelBookingResult {
  success: boolean;
  error?: string;
}

export async function cancelBookingByToken(
  token: string,
  reason?: string | null
): Promise<CancelBookingResult> {
  const supabase = createServiceClient();

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, status, token_expires_at, host_user_id, event_type_id, project_id')
    .eq('cancel_token', token)
    .single();

  if (error || !booking) {
    return { success: false, error: 'Invalid cancel token' };
  }

  if (booking.token_expires_at && new Date(booking.token_expires_at) < new Date()) {
    return { success: false, error: 'Cancel token has expired' };
  }

  if (['cancelled', 'completed', 'no_show', 'rescheduled'].includes(booking.status)) {
    return { success: false, error: 'Booking cannot be cancelled in its current status' };
  }

  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_by: 'invitee',
      cancellation_reason: reason || null,
    })
    .eq('id', booking.id);

  if (updateError) {
    return { success: false, error: 'Failed to cancel booking' };
  }

  // Send cancellation notification (fire-and-forget)
  sendBookingCancellation(booking.id).catch((err) =>
    console.error('Failed to send cancellation notification:', err)
  );

  // Remove from Google Calendar (fire-and-forget)
  removeBookingFromCalendar(booking.id).catch((err) =>
    console.error('Failed to remove booking from Google Calendar:', err)
  );

  // Emit automation event (fire-and-forget)
  emitAutomationEvent({
    projectId: booking.project_id,
    triggerType: 'booking.cancelled',
    entityType: 'booking',
    entityId: booking.id,
    data: { booking_id: booking.id, cancelled_by: 'invitee' },
  }).catch((err) => console.error('Failed to emit booking.cancelled event:', err));

  // Sync cancellation to CRM meeting (fire-and-forget)
  syncBookingStatusToMeeting(booking.id, 'cancelled').catch((err) =>
    console.error('Failed to sync booking cancellation to CRM meeting:', err)
  );

  return { success: true };
}

export async function cancelBookingByHost(
  bookingId: string,
  hostUserId: string,
  reason?: string | null
): Promise<CancelBookingResult> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_by: 'host',
      cancellation_reason: reason || null,
    })
    .eq('id', bookingId)
    .eq('host_user_id', hostUserId)
    .in('status', ['confirmed', 'pending'])
    .select('id, project_id')
    .single();

  if (error || !data) {
    return { success: false, error: 'Booking not found or already cancelled' };
  }

  sendBookingCancellation(bookingId).catch((err) =>
    console.error('Failed to send cancellation notification:', err)
  );

  // Remove from Google Calendar (fire-and-forget)
  removeBookingFromCalendar(bookingId).catch((err) =>
    console.error('Failed to remove booking from Google Calendar:', err)
  );

  // Emit automation event (fire-and-forget)
  emitAutomationEvent({
    projectId: data.project_id,
    triggerType: 'booking.cancelled',
    entityType: 'booking',
    entityId: bookingId,
    data: { booking_id: bookingId, cancelled_by: 'host' },
  }).catch((err) => console.error('Failed to emit booking.cancelled event:', err));

  // Sync cancellation to CRM meeting (fire-and-forget)
  syncBookingStatusToMeeting(bookingId, 'cancelled').catch((err) =>
    console.error('Failed to sync booking cancellation to CRM meeting:', err)
  );

  return { success: true };
}

// ============================================================
// Reschedule booking
// ============================================================

interface RescheduleResult {
  success: boolean;
  newBookingId?: string;
  error?: string;
  errorCode?: string;
}

export async function rescheduleBookingByToken(
  token: string,
  newStartAt: string
): Promise<RescheduleResult> {
  const supabase = createServiceClient();

  // Load original booking
  const { data: original, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('reschedule_token', token)
    .single();

  if (error || !original) {
    return { success: false, error: 'Invalid reschedule token' };
  }

  if (original.token_expires_at && new Date(original.token_expires_at) < new Date()) {
    return { success: false, error: 'Reschedule token has expired' };
  }

  if (original.status !== 'confirmed' && original.status !== 'pending') {
    return { success: false, error: 'Booking cannot be rescheduled in its current status' };
  }

  // Mark original as rescheduled BEFORE creating the new booking
  // so the old booking doesn't count toward daily/weekly limits
  const { error: markError } = await supabase
    .from('bookings')
    .update({ status: 'rescheduled' })
    .eq('id', original.id);

  if (markError) {
    return { success: false, error: 'Failed to update original booking status' };
  }

  // Create new booking via the standard flow (preserves buffers from same event type)
  const result = await createBooking({
    eventTypeId: original.event_type_id,
    startAt: newStartAt,
    inviteeName: original.invitee_name,
    inviteeEmail: original.invitee_email,
    inviteePhone: original.invitee_phone,
    inviteeTimezone: original.invitee_timezone,
    inviteeNotes: original.invitee_notes,
    location: original.location,
    meetingUrl: original.meeting_url,
    responses: (original.responses as Record<string, unknown>) || {},
    excludeBookingId: original.id,
  });

  if (!result.success) {
    // Revert the original booking status since the new booking failed
    await supabase
      .from('bookings')
      .update({ status: original.status })
      .eq('id', original.id);
    return { success: false, error: result.error, errorCode: result.errorCode };
  }

  // Link new booking to original
  if (result.bookingId) {
    await supabase
      .from('bookings')
      .update({ rescheduled_from_id: original.id })
      .eq('id', result.bookingId);
  }

  // Remove old booking from Google Calendar and push new one (fire-and-forget)
  removeBookingFromCalendar(original.id).catch((e: unknown) =>
    console.error('Failed to remove rescheduled booking from Google Calendar:', e)
  );

  // Emit automation event (fire-and-forget)
  emitAutomationEvent({
    projectId: original.project_id,
    triggerType: 'booking.rescheduled',
    entityType: 'booking',
    entityId: original.id,
    data: {
      old_booking_id: original.id,
      new_booking_id: result.bookingId,
    },
  }).catch((err) => console.error('Failed to emit booking.rescheduled event:', err));

  // Sync rescheduled status to CRM meeting (fire-and-forget)
  syncBookingStatusToMeeting(original.id, 'rescheduled').catch((e: unknown) =>
    console.error('Failed to sync booking reschedule to CRM meeting:', e)
  );

  return { success: true, newBookingId: result.bookingId };
}

// ============================================================
// Helpers
// ============================================================

function handleRpcError(rpcError: { message?: string }): CreateBookingResult {
  const msg = rpcError.message || '';
  if (msg.includes('SLOT_TAKEN')) {
    return { success: false, error: 'This time slot is no longer available', errorCode: 'SLOT_TAKEN' };
  }
  if (msg.includes('DAILY_LIMIT')) {
    return { success: false, error: 'Daily booking limit reached', errorCode: 'DAILY_LIMIT' };
  }
  if (msg.includes('WEEKLY_LIMIT')) {
    return { success: false, error: 'Weekly booking limit reached', errorCode: 'WEEKLY_LIMIT' };
  }
  return { success: false, error: msg };
}

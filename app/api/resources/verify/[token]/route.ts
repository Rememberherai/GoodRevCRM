/**
 * Verification token API.
 *
 * GET  — validate token and return pending request details
 * POST — consume token, create/match person, create booking, return outcome
 *
 * No auth required.
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createAssetBooking } from '@/lib/asset-access/service';
import { getAvailableSlots } from '@/lib/calendar/slots';
import { getAssetAccessContext, insertAccessEvent } from '@/lib/asset-access/queries';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { formatInTimeZone } from 'date-fns-tz';

interface RouteContext {
  params: Promise<{ token: string }>;
}

// ── GET: check token status ────────────────────────────────────

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const supabase = createServiceClient();

    const { data: verification } = await supabase
      .from('asset_access_verifications')
      .select(`
        id, status, expires_at, requested_start_at, requested_end_at,
        asset_id, event_type_id, guest_name, email
      `)
      .eq('token', token)
      .single();

    if (!verification) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Invalid verification token' } }, { status: 404 });
    }

    // Check expiry
    if (verification.status === 'expired' || new Date(verification.expires_at) < new Date()) {
      if (verification.status === 'pending') {
        await supabase
          .from('asset_access_verifications')
          .update({ status: 'expired' })
          .eq('id', verification.id);
      }
      return NextResponse.json({ error: { code: 'not_found', message: 'Verification token has expired' } }, { status: 410 });
    }

    // Load asset name and event type title for display
    const [assetResult, eventTypeResult] = await Promise.all([
      supabase.from('community_assets').select('name, public_name').eq('id', verification.asset_id).single(),
      supabase.from('event_types').select('title, duration_minutes').eq('id', verification.event_type_id).single(),
    ]);

    return NextResponse.json({
      asset_name: assetResult.data?.public_name || assetResult.data?.name || 'Resource',
      preset_name: eventTypeResult.data?.title || 'Access',
      duration_minutes: eventTypeResult.data?.duration_minutes,
      requested_start_at: verification.requested_start_at,
      requested_end_at: verification.requested_end_at,
      expires_at: verification.expires_at,
      status: verification.status,
    });
  } catch (error) {
    console.error('Error in GET /api/resources/verify/[token]:', error);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Internal server error' } }, { status: 500 });
  }
}

// ── POST: consume token, create person + booking ───────────────

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const supabase = createServiceClient();

    // Load and validate verification
    const { data: verification } = await supabase
      .from('asset_access_verifications')
      .select('*')
      .eq('token', token)
      .single();

    if (!verification) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Invalid verification token' } }, { status: 404 });
    }

    // If already verified, return the existing booking outcome (idempotent)
    if (verification.status === 'verified') {
      return await getExistingBookingOutcome(supabase, verification);
    }

    // Check expiry
    if (verification.status === 'expired' || new Date(verification.expires_at) < new Date()) {
      if (verification.status === 'pending') {
        await supabase
          .from('asset_access_verifications')
          .update({ status: 'expired' })
          .eq('id', verification.id);
      }
      return NextResponse.json({ error: { code: 'not_found', message: 'Verification token has expired' } }, { status: 410 });
    }

    // Mark as verified (single-use)
    const { data: updatedVerification, error: updateError } = await supabase
      .from('asset_access_verifications')
      .update({ status: 'verified', verified_at: new Date().toISOString() })
      .eq('id', verification.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle(); // CAS: only update if still pending

    if (updateError) {
      console.error('Failed to mark verification as verified:', updateError.message);
      return NextResponse.json({ error: { code: 'conflict', message: 'Verification already processed' } }, { status: 409 });
    }

    if (!updatedVerification) {
      return await getExistingBookingOutcome(supabase, verification);
    }

    // Log verified event
    insertAccessEvent(supabase, {
      project_id: verification.project_id,
      verification_id: verification.id,
      action: 'verified',
      actor_type: 'guest',
    }).catch((e) => console.error('Failed to log verified event:', e));

    emitAutomationEvent({
      projectId: verification.project_id,
      triggerType: 'asset_access.verified',
      entityType: 'asset_access_booking',
      entityId: verification.id,
      data: { verification_id: verification.id, asset_id: verification.asset_id },
    }).catch((e) => console.error('Failed to emit asset_access.verified:', e));

    // Create or match person by email within the project
    const personId = await findOrCreatePerson(supabase, {
      projectId: verification.project_id,
      email: verification.email,
      name: verification.guest_name,
    });

    if (!personId) {
      await resetVerificationToPending(supabase, verification.id);
      return NextResponse.json(
        { error: { code: 'conflict', message: 'Failed to create or match contact for this request' } },
        { status: 409 }
      );
    }

    // Load asset context for notification info
    const ctx = await getAssetAccessContext(supabase, verification.asset_id);
    if (!ctx) {
      await resetVerificationToPending(supabase, verification.id);
      return NextResponse.json({ error: { code: 'not_found', message: 'Resource no longer available' } }, { status: 404 });
    }

    const { data: eventTypeForSlot } = await supabase
      .from('event_types')
      .select('id, schedule_id, user_id')
      .eq('id', verification.event_type_id)
      .maybeSingle();

    if (!eventTypeForSlot) {
      await resetVerificationToPending(supabase, verification.id);
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Access preset no longer exists' } },
        { status: 404 }
      );
    }

    const slotStillAvailable = await isRequestedSlotAvailable(
      supabase,
      verification.event_type_id,
      verification.requested_start_at,
      eventTypeForSlot.schedule_id,
      eventTypeForSlot.user_id
    );

    if (!slotStillAvailable) {
      return NextResponse.json({ outcome: 'slot_taken' });
    }

    // Create booking via the asset-scoped service
    // The service internally calls evaluateApprovalPolicy with the personId
    // to handle approved_only bypass
    const result = await createAssetBooking({
      assetId: verification.asset_id,
      eventTypeId: verification.event_type_id,
      startAt: verification.requested_start_at,
      inviteeName: verification.guest_name,
      inviteeEmail: verification.email,
      inviteeNotes: null,
      personId: personId,
      responses: (verification.responses as Record<string, unknown>) ?? undefined,
    });

    if (!result.success) {
      if (result.errorCode === 'CAPACITY_EXHAUSTED') {
        return NextResponse.json({ outcome: 'slot_taken' });
      }
      await resetVerificationToPending(supabase, verification.id);
      return NextResponse.json(
        { error: { code: 'conflict', message: result.error || 'Failed to create booking' } },
        { status: 409 }
      );
    }

    // Load the created booking for tokens
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, status, cancel_token, reschedule_token, ics_token')
      .eq('id', result.bookingId!)
      .single();

    const outcome = booking?.status === 'confirmed' ? 'confirmed' : 'pending_review';

    // Send appropriate notification
    if (outcome === 'confirmed') {
      import('@/lib/asset-access/notifications').then(({ sendConfirmedEmail }) => {
        sendConfirmedEmail(result.bookingId!, verification.project_id).catch((e: unknown) =>
          console.error('Failed to send confirmed email:', e)
        );
      }).catch((e: unknown) => console.error('Failed to import notifications:', e));
    } else {
      import('@/lib/asset-access/notifications').then(({ sendQueuedEmail, sendNewRequestNotification }) => {
        sendQueuedEmail({
          guestName: verification.guest_name,
          guestEmail: verification.email,
          assetName: ctx.asset.public_name || ctx.asset.name,
          projectId: verification.project_id,
        }).catch((e: unknown) => console.error('Failed to send queued email:', e));

        sendNewRequestNotification({
          bookingId: result.bookingId!,
          assetId: verification.asset_id,
          projectId: verification.project_id,
          assetName: ctx.asset.public_name || ctx.asset.name,
          guestName: verification.guest_name,
          requestedStartAt: verification.requested_start_at,
        }).catch((e: unknown) => console.error('Failed to send approver notification:', e));
      }).catch((e: unknown) => console.error('Failed to import notifications:', e));
    }

    if (outcome === 'confirmed') {
      return NextResponse.json({
        outcome: 'confirmed',
        booking_id: result.bookingId,
        cancel_token: booking?.cancel_token,
        reschedule_token: booking?.reschedule_token,
        ics_token: booking?.ics_token,
      });
    }

    return NextResponse.json({
      outcome: 'pending_review',
      booking_id: result.bookingId,
    });
  } catch (error) {
    console.error('Error in POST /api/resources/verify/[token]:', error);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Internal server error' } }, { status: 500 });
  }
}

// ── Helpers ────────────────────────────────────────────────────

async function findOrCreatePerson(
  supabase: ReturnType<typeof createServiceClient>,
  opts: { projectId: string; email: string; name: string }
): Promise<string | null> {
  const normalizedEmail = opts.email.toLowerCase().trim();

  // Try to find existing person by email in this project
  const { data: existing } = await supabase
    .from('people')
    .select('id')
    .eq('project_id', opts.projectId)
    .eq('email', normalizedEmail)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id;

  // Create lightweight person record
  const nameParts = opts.name.trim().split(/\s+/);
  const firstName = nameParts[0] || opts.name;
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

  const { data: newPerson, error } = await supabase
    .from('people')
    .insert({
      project_id: opts.projectId,
      first_name: firstName,
      last_name: lastName,
      email: normalizedEmail,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to create person:', error.message);
    return null;
  }

  return newPerson?.id ?? null;
}

async function getExistingBookingOutcome(
  supabase: ReturnType<typeof createServiceClient>,
  verification: { id: string; asset_id: string; event_type_id: string; email: string; requested_start_at: string }
) {
  // Find the booking created from this verification's parameters
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, cancel_token, reschedule_token, ics_token')
    .eq('event_type_id', verification.event_type_id)
    .eq('invitee_email', verification.email.toLowerCase().trim())
    .eq('start_at', verification.requested_start_at)
    .in('status', ['confirmed', 'pending', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!booking) {
    return NextResponse.json({ outcome: 'slot_taken' });
  }

  if (booking.status === 'confirmed') {
    return NextResponse.json({
      outcome: 'confirmed',
      booking_id: booking.id,
      cancel_token: booking.cancel_token,
      reschedule_token: booking.reschedule_token,
      ics_token: booking.ics_token,
    });
  }

  return NextResponse.json({
    outcome: 'pending_review',
    booking_id: booking.id,
  });
}

async function resetVerificationToPending(
  supabase: ReturnType<typeof createServiceClient>,
  verificationId: string
) {
  await supabase
    .from('asset_access_verifications')
    .update({ status: 'pending', verified_at: null })
    .eq('id', verificationId);
}

async function isRequestedSlotAvailable(
  supabase: ReturnType<typeof createServiceClient>,
  eventTypeId: string,
  startAt: string,
  scheduleId: string | null,
  userId: string
): Promise<boolean> {
  let timezone = 'America/New_York';

  if (scheduleId) {
    const { data: schedule } = await supabase
      .from('availability_schedules')
      .select('timezone')
      .eq('id', scheduleId)
      .maybeSingle();
    if (schedule?.timezone) timezone = schedule.timezone;
  } else {
    const { data: defaultSchedule } = await supabase
      .from('availability_schedules')
      .select('timezone')
      .eq('user_id', userId)
      .eq('is_default', true)
      .maybeSingle();
    if (defaultSchedule?.timezone) timezone = defaultSchedule.timezone;
  }

  const dateKey = formatInTimeZone(new Date(startAt), timezone, 'yyyy-MM-dd');
  const days = await getAvailableSlots({
    eventTypeId,
    startDate: dateKey,
    endDate: dateKey,
    inviteeTimezone: timezone,
  });

  return days.some((day) => day.slots.some((slot) => slot.start === startAt));
}

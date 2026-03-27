/**
 * Public booking request API — creates a verification row and sends email.
 * Rate-limited by IP and email.
 * No auth required.
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';
import { publicBookRequestSchema } from '@/lib/validators/asset-access';
import { checkRateLimit } from '@/lib/calendar/service';
import { getAvailableSlots } from '@/lib/calendar/slots';
import { insertAccessEvent } from '@/lib/asset-access/queries';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { randomBytes } from 'crypto';
import { formatInTimeZone } from 'date-fns-tz';

interface RouteContext {
  params: Promise<{ hubSlug: string; resourceSlug: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { hubSlug, resourceSlug } = await context.params;

    // Parse and validate body
    const raw = await request.json();
    const validation = publicBookRequestSchema.safeParse(raw);
    if (!validation.success) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'Invalid request', details: validation.error.flatten() } },
        { status: 400 }
      );
    }

    const { event_type_id, start_at, guest_name, guest_email, responses } = validation.data;

    // Rate limit by IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const ipLimit = await checkRateLimit(`resource_book:ip:${ip}`, 10, 60);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: { code: 'rate_limited', message: 'Too many requests. Please try again later.' } },
        { status: 429 }
      );
    }

    // Rate limit by email
    const emailLimit = await checkRateLimit(`resource_book:email:${guest_email}`, 5, 60);
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { error: { code: 'rate_limited', message: 'Too many requests for this email. Please try again later.' } },
        { status: 429 }
      );
    }

    const supabase = createServiceClient();

    // Resolve hub
    const { data: hub } = await supabase
      .from('asset_access_settings')
      .select('project_id, is_enabled')
      .eq('slug', hubSlug)
      .single();

    if (!hub || !hub.is_enabled) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Resource hub not found' } }, { status: 404 });
    }

    // Resolve asset
    const { data: asset } = await supabase
      .from('community_assets')
      .select('id, name, public_name, access_enabled, project_id')
      .eq('project_id', hub.project_id)
      .eq('resource_slug', resourceSlug)
      .eq('access_enabled', true)
      .not('booking_owner_user_id', 'is', null)
      .single();

    if (!asset) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Resource not found' } }, { status: 404 });
    }

    // Verify event type belongs to this asset
    const { data: eventType } = await supabase
      .from('event_types')
      .select('id, asset_id, duration_minutes, schedule_id, user_id')
      .eq('id', event_type_id)
      .eq('asset_id', asset.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!eventType) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Access preset not found for this resource' } },
        { status: 404 }
      );
    }

    // Calculate end time from event type duration
    const startAtDate = new Date(start_at);
    const endAtDate = new Date(startAtDate.getTime() + eventType.duration_minutes * 60 * 1000);

    const slotStillAvailable = await isRequestedSlotAvailable(
      supabase,
      event_type_id,
      startAtDate.toISOString(),
      eventType.schedule_id,
      eventType.user_id
    );

    if (!slotStillAvailable) {
      return NextResponse.json(
        { error: { code: 'conflict', message: 'Selected time is no longer available' } },
        { status: 409 }
      );
    }

    // Generate verification token (32 bytes, hex-encoded)
    const token = randomBytes(32).toString('hex');

    // Expiry: 30 minutes from now
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    // Create verification row
    const { data: verification, error: insertError } = await supabase
      .from('asset_access_verifications')
      .insert({
        token,
        project_id: asset.project_id,
        asset_id: asset.id,
        event_type_id: event_type_id,
        email: guest_email,
        guest_name: guest_name,
        requested_start_at: startAtDate.toISOString(),
        requested_end_at: endAtDate.toISOString(),
        responses: (responses ?? {}) as Json,
        status: 'pending',
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (insertError || !verification) {
      console.error('Failed to create verification:', insertError?.message);
      return NextResponse.json(
        { error: { code: 'internal_error', message: 'Failed to create verification' } },
        { status: 500 }
      );
    }

    // Log audit event
    insertAccessEvent(supabase, {
      project_id: asset.project_id,
      verification_id: verification.id,
      action: 'submitted',
      actor_type: 'guest',
      metadata: { asset_id: asset.id, guest_email, guest_name },
    }).catch((e) => console.error('Failed to log submitted event:', e));

    // Emit automation event
    emitAutomationEvent({
      projectId: asset.project_id,
      triggerType: 'asset_access.submitted',
      entityType: 'asset_access_booking',
      entityId: verification.id,
      data: {
        verification_id: verification.id,
        asset_id: asset.id,
        asset_name: asset.public_name || asset.name,
        guest_email,
        guest_name,
      },
    }).catch((e) => console.error('Failed to emit asset_access.submitted:', e));

    // Send verification email (fire-and-forget)
    import('@/lib/asset-access/notifications').then(({ sendVerificationEmail }) => {
      sendVerificationEmail({
        verificationId: verification.id,
        token,
        projectId: asset.project_id,
        assetName: asset.public_name || asset.name,
        guestName: guest_name,
        guestEmail: guest_email,
        requestedStartAt: startAtDate.toISOString(),
        requestedEndAt: endAtDate.toISOString(),
        expiresAt,
      }).catch((e) => console.error('Failed to send verification email:', e));
    }).catch((e) => console.error('Failed to import notifications:', e));

    // Log verification_sent event
    insertAccessEvent(supabase, {
      project_id: asset.project_id,
      verification_id: verification.id,
      action: 'verification_sent',
      actor_type: 'system',
    }).catch((e) => console.error('Failed to log verification_sent event:', e));

    return NextResponse.json({ verification_sent: true });
  } catch (error) {
    console.error('Error in POST /api/resources/[hubSlug]/[resourceSlug]/book:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Internal server error' } },
      { status: 500 }
    );
  }
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

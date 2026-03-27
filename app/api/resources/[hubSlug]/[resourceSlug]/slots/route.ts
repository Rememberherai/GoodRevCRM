/**
 * Public slot API — returns available slots for an asset-linked event type.
 * Wrapper over the asset-aware slot engine.
 * No auth required.
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAvailableSlots } from '@/lib/calendar/slots';

interface RouteContext {
  params: Promise<{ hubSlug: string; resourceSlug: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { hubSlug, resourceSlug } = await context.params;
    const { searchParams } = new URL(request.url);

    const eventTypeId = searchParams.get('event_type_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const timezone = searchParams.get('timezone');

    if (!eventTypeId || !startDate || !endDate) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'event_type_id, start_date, and end_date are required' } },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Verify hub + asset exist and event type belongs to this asset
    const { data: hub } = await supabase
      .from('asset_access_settings')
      .select('project_id, is_enabled')
      .eq('slug', hubSlug)
      .single();

    if (!hub || !hub.is_enabled) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Resource hub not found' } }, { status: 404 });
    }

    const { data: asset } = await supabase
      .from('community_assets')
      .select('id, access_enabled')
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
      .eq('id', eventTypeId)
      .eq('asset_id', asset.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!eventType) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Access preset not found' } }, { status: 404 });
    }

    // Get available slots via the asset-aware slot engine
    const days = await getAvailableSlots({
      eventTypeId,
      startDate,
      endDate,
      inviteeTimezone: timezone || undefined,
    });

    let resolvedTimezone = 'America/New_York';
    if (eventType.schedule_id) {
      const { data: schedule } = await supabase
        .from('availability_schedules')
        .select('timezone')
        .eq('id', eventType.schedule_id)
        .maybeSingle();
      if (schedule?.timezone) resolvedTimezone = schedule.timezone;
    } else if (eventType.user_id) {
      const { data: defaultSchedule } = await supabase
        .from('availability_schedules')
        .select('timezone')
        .eq('user_id', eventType.user_id)
        .eq('is_default', true)
        .maybeSingle();
      if (defaultSchedule?.timezone) resolvedTimezone = defaultSchedule.timezone;
    }

    return NextResponse.json({
      days,
      timezone: resolvedTimezone,
      slot_duration_minutes: eventType.duration_minutes,
    });
  } catch (error) {
    console.error('Error in GET /api/resources/[hubSlug]/[resourceSlug]/slots:', error);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Internal server error' } }, { status: 500 });
  }
}

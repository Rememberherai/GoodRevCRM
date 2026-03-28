/**
 * Public asset detail API — returns asset info + access presets for a specific resource.
 * No auth required.
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ hubSlug: string; resourceSlug: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { hubSlug, resourceSlug } = await context.params;
    const supabase = createServiceClient();

    // Resolve hub
    const { data: hub } = await supabase
      .from('asset_access_settings')
      .select('project_id, slug, is_enabled')
      .eq('slug', hubSlug)
      .single();

    if (!hub || !hub.is_enabled) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Resource hub not found' } }, { status: 404 });
    }

    // Resolve asset by resource_slug within this project
    const { data: asset } = await supabase
      .from('community_assets')
      .select(`
        id, name, public_name, public_description, access_mode,
        resource_slug, access_enabled, approval_policy,
        concurrent_capacity, booking_owner_user_id,
        return_required, access_instructions, public_visibility,
        custom_questions
      `)
      .eq('project_id', hub.project_id)
      .eq('resource_slug', resourceSlug)
      .eq('access_enabled', true)
      .not('booking_owner_user_id', 'is', null)
      .neq('access_mode', 'tracked_only')
      .single();

    if (!asset) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Resource not found' } }, { status: 404 });
    }

    // Load active access presets (event types linked to this asset)
    const { data: presets } = await supabase
      .from('event_types')
      .select('id, title, slug, description, duration_minutes, buffer_before_minutes, buffer_after_minutes, custom_questions')
      .eq('asset_id', asset.id)
      .eq('is_active', true)
      .order('duration_minutes', { ascending: true });

    // Load schedule timezone for display
    let timezone = 'America/New_York';
    const firstPreset = presets?.[0];
    if (firstPreset) {
      const { data: et } = await supabase
        .from('event_types')
        .select('schedule_id, user_id')
        .eq('id', firstPreset.id)
        .single();

      if (et?.schedule_id) {
        const { data: schedule } = await supabase
          .from('availability_schedules')
          .select('timezone')
          .eq('id', et.schedule_id)
          .maybeSingle();
        if (schedule) timezone = schedule.timezone;
      } else if (et?.user_id) {
        const { data: defaultSchedule } = await supabase
          .from('availability_schedules')
          .select('timezone')
          .eq('user_id', et.user_id)
          .eq('is_default', true)
          .maybeSingle();
        if (defaultSchedule) timezone = defaultSchedule.timezone;
      }
    }

    return NextResponse.json({
      asset: {
        id: asset.id,
        name: asset.public_name || asset.name,
        description: asset.public_description,
        access_mode: asset.access_mode,
        approval_policy: asset.approval_policy,
        concurrent_capacity: asset.concurrent_capacity,
        return_required: asset.return_required,
        access_instructions: asset.access_instructions,
        custom_questions: asset.custom_questions,
      },
      presets: (presets ?? []).map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        description: p.description,
        duration_minutes: p.duration_minutes,
        custom_questions: p.custom_questions,
      })),
      timezone,
    });
  } catch (error) {
    console.error('Error in GET /api/resources/[hubSlug]/[resourceSlug]:', error);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Internal server error' } }, { status: 500 });
  }
}

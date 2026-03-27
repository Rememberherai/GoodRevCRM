/**
 * Asset event types (booking presets) API — CRUD for event types linked to a community asset.
 * These presets define what booking options are available on the public resource page.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

const createPresetSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(5000).nullable().optional(),
  duration_minutes: z.number().int().min(5).max(480).default(30),
  color: z.string().max(50).optional().default('#3b82f6'),
  location_type: z.enum(['video', 'phone', 'in_person', 'custom', 'ask_invitee']).default('in_person'),
  location_value: z.string().max(2000).nullable().optional(),
  buffer_before_minutes: z.number().int().min(0).max(120).default(0),
  buffer_after_minutes: z.number().int().min(0).max(120).default(0),
  min_notice_hours: z.number().int().min(0).max(720).default(24),
  max_days_in_advance: z.number().int().min(1).max(365).default(60),
  requires_confirmation: z.boolean().optional().default(false),
});

const updatePresetSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  duration_minutes: z.number().int().min(5).max(480).optional(),
  color: z.string().max(50).optional(),
  location_type: z.enum(['video', 'phone', 'in_person', 'custom', 'ask_invitee']).optional(),
  location_value: z.string().max(2000).nullable().optional(),
  buffer_before_minutes: z.number().int().min(0).max(120).optional(),
  buffer_after_minutes: z.number().int().min(0).max(120).optional(),
  min_notice_hours: z.number().int().min(0).max(720).optional(),
  max_days_in_advance: z.number().int().min(1).max(365).optional(),
  requires_confirmation: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

// GET — List event types for this asset
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project || project.project_type !== 'community') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await requireCommunityPermission(supabase, user.id, project.id, 'asset_access', 'view');

    const { data: eventTypes, error } = await supabase
      .from('event_types')
      .select('id, title, slug, description, duration_minutes, color, is_active, location_type, location_value, buffer_before_minutes, buffer_after_minutes, min_notice_hours, max_days_in_advance, requires_confirmation, schedule_id, created_at')
      .eq('project_id', project.id)
      .eq('asset_id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ event_types: eventTypes ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/community-assets/[id]/event-types:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — Create a new booking preset for this asset
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project || project.project_type !== 'community') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const role = await requireCommunityPermission(supabase, user.id, project.id, 'asset_access', 'manage');
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can manage booking presets' }, { status: 403 });
    }

    // Verify the asset exists and belongs to this project
    const { data: asset } = await supabase
      .from('community_assets')
      .select('id, booking_owner_user_id')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = createPresetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    // Generate a slug from the title
    const baseSlug = parsed.data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
    const uniqueSlug = baseSlug
      ? `${baseSlug}-${Date.now().toString(36)}`
      : `preset-${Date.now().toString(36)}`;

    // Determine the user_id for the event type — use the asset's booking owner if set, otherwise the current user
    const eventTypeUserId = asset.booking_owner_user_id ?? user.id;

    // Auto-create or find an availability schedule for the booking owner
    let scheduleId: string | null = null;
    const { data: existingSchedule } = await supabase
      .from('availability_schedules')
      .select('id')
      .eq('user_id', eventTypeUserId)
      .order('is_default', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSchedule) {
      scheduleId = existingSchedule.id;
    } else {
      // Create a default schedule with weekday 9am-5pm
      const { data: newSchedule } = await supabase
        .from('availability_schedules')
        .insert({
          user_id: eventTypeUserId,
          name: 'Default Hours',
          timezone: 'America/New_York',
          is_default: true,
        })
        .select('id')
        .single();

      if (newSchedule) {
        scheduleId = newSchedule.id;
        // Add weekday rules (Mon-Fri, 9am-5pm)
        const rules = [1, 2, 3, 4, 5].map((day) => ({
          schedule_id: newSchedule.id,
          day_of_week: day,
          start_time: '09:00',
          end_time: '17:00',
        }));
        await supabase.from('availability_rules').insert(rules);
      }
    }

    const { data: eventType, error } = await supabase
      .from('event_types')
      .insert({
        ...parsed.data,
        slug: uniqueSlug,
        project_id: project.id,
        user_id: eventTypeUserId,
        asset_id: id,
        schedule_id: scheduleId,
        scheduling_type: 'one_on_one',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A preset with this name already exists' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ event_type: eventType }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/community-assets/[id]/event-types:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH — Update a booking preset (pass event_type_id in body)
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project || project.project_type !== 'community') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const role = await requireCommunityPermission(supabase, user.id, project.id, 'asset_access', 'manage');
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can manage booking presets' }, { status: 403 });
    }

    const body = await request.json();
    const eventTypeId = body.event_type_id;
    if (!eventTypeId || typeof eventTypeId !== 'string') {
      return NextResponse.json({ error: 'event_type_id is required' }, { status: 400 });
    }

    // Verify the event type belongs to this asset
    const { data: existing } = await supabase
      .from('event_types')
      .select('id')
      .eq('id', eventTypeId)
      .eq('asset_id', id)
      .eq('project_id', project.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Event type not found for this asset' }, { status: 404 });
    }

    const { event_type_id: _, ...updateFields } = body;
    const parsed = updatePresetSchema.safeParse(updateFields);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const { data: eventType, error } = await supabase
      .from('event_types')
      .update(parsed.data)
      .eq('id', eventTypeId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ event_type: eventType });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PATCH /api/projects/[slug]/community-assets/[id]/event-types:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — Remove a booking preset
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project || project.project_type !== 'community') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const role = await requireCommunityPermission(supabase, user.id, project.id, 'asset_access', 'manage');
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can manage booking presets' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const eventTypeId = searchParams.get('event_type_id');
    if (!eventTypeId) {
      return NextResponse.json({ error: 'event_type_id query param is required' }, { status: 400 });
    }

    // Verify the event type belongs to this asset
    const { data: existing } = await supabase
      .from('event_types')
      .select('id')
      .eq('id', eventTypeId)
      .eq('asset_id', id)
      .eq('project_id', project.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Event type not found for this asset' }, { status: 404 });
    }

    // Check for existing bookings — if any, deactivate instead of deleting
    const { count } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('event_type_id', eventTypeId);

    if (count && count > 0) {
      // Deactivate instead of deleting to preserve booking history
      await supabase
        .from('event_types')
        .update({ is_active: false })
        .eq('id', eventTypeId);

      return NextResponse.json({ deactivated: true, message: 'Preset deactivated (has existing bookings)' });
    }

    const { error } = await supabase
      .from('event_types')
      .delete()
      .eq('id', eventTypeId);

    if (error) throw error;

    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/projects/[slug]/community-assets/[id]/event-types:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { z } from 'zod';

const createBookingSchema = z.object({
  event_type_id: z.string().uuid().optional(),
  title: z.string().max(200).optional(),
  start_at: z.string().min(1, 'start_at is required'),
  end_at: z.string().min(1, 'end_at is required'),
  invitee_name: z.string().min(1, 'invitee_name is required').max(200),
  invitee_email: z.string().email('Valid email is required'),
  status: z.string().max(50).optional(),
});

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: project } = await supabase.from('projects').select('id, project_type').eq('slug', slug).is('deleted_at', null).single();
    if (!project || project.project_type !== 'community') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    await requireCommunityPermission(supabase, user.id, project.id, 'community_assets', 'view');

    const { data: eventTypes } = await supabase
      .from('event_types')
      .select('id, title, color, duration_minutes, location_type')
      .eq('project_id', project.id)
      .eq('asset_id', id)
      .order('title');

    const eventTypeIds = (eventTypes ?? []).map((item) => item.id);
    const bookings = eventTypeIds.length === 0
      ? []
      : (await supabase
          .from('bookings')
          .select('id, start_at, end_at, status, invitee_name, invitee_email, event_type_id')
          .eq('project_id', project.id)
          .in('event_type_id', eventTypeIds)
          .order('start_at', { ascending: true })).data ?? [];

    return NextResponse.json({ event_types: eventTypes ?? [], bookings });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /api/projects/[slug]/community-assets/[id]/bookings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: project } = await supabase.from('projects').select('id, project_type').eq('slug', slug).is('deleted_at', null).single();
    if (!project || project.project_type !== 'community') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    await requireCommunityPermission(supabase, user.id, project.id, 'community_assets', 'update');

    const raw = await request.json();
    const validation = createBookingSchema.safeParse(raw);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }
    const body = validation.data;

    const { data: assetEventTypes } = await supabase
      .from('event_types')
      .select('id')
      .eq('project_id', project.id)
      .eq('asset_id', id);

    const assetEventTypeIds = (assetEventTypes ?? []).map((item) => item.id);
    if (assetEventTypeIds.length > 0) {
      const { data: overlappingBookings } = await supabase
        .from('bookings')
        .select('id')
        .eq('project_id', project.id)
        .in('event_type_id', assetEventTypeIds)
        .lt('start_at', body.end_at)
        .gt('end_at', body.start_at)
        .limit(1);

      if ((overlappingBookings ?? []).length > 0) {
        return NextResponse.json({ error: 'Booking conflicts with an existing reservation' }, { status: 409 });
      }
    }

    let eventTypeId = body.event_type_id ?? null;
    if (!eventTypeId) {
      const slugBase = (body.title ?? 'asset-booking').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const { data: eventType, error: eventTypeError } = await supabase
        .from('event_types')
        .insert({
          project_id: project.id,
          user_id: user.id,
          asset_id: id,
          title: body.title ?? 'Community Asset Booking',
          slug: `${slugBase || 'asset-booking'}-${Date.now()}`,
          duration_minutes: Math.max(30, Math.round((new Date(body.end_at).getTime() - new Date(body.start_at).getTime()) / 60000)),
          location_type: 'in_person',
          is_active: true,
        })
        .select('id')
        .single();

      if (eventTypeError || !eventType) throw eventTypeError ?? new Error('Failed to create event type');
      eventTypeId = eventType.id;
    }

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        project_id: project.id,
        event_type_id: eventTypeId,
        host_user_id: user.id,
        start_at: body.start_at,
        end_at: body.end_at,
        effective_block_start: body.start_at,
        effective_block_end: body.end_at,
        invitee_name: body.invitee_name,
        invitee_email: body.invitee_email,
        status: body.status ?? 'confirmed',
      })
      .select()
      .single();

    if (error || !data) throw error ?? new Error('Failed to create booking');
    emitAutomationEvent({ projectId: project.id, triggerType: 'booking.created' as never, entityType: 'booking', entityId: data.id, data: data as unknown as Record<string, unknown> });
    return NextResponse.json({ booking: data }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in POST /api/projects/[slug]/community-assets/[id]/bookings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

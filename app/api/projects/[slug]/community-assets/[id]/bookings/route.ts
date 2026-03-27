import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireAssetAccessManage, requireCommunityPermission } from '@/lib/projects/community-permissions';
import { createAssetBooking } from '@/lib/asset-access/service';
import { listAssetBookings } from '@/lib/asset-access/queries';
import { z } from 'zod';

const createBookingSchema = z.object({
  event_type_id: z.string().uuid().optional(),
  start_at: z.string().min(1, 'start_at is required'),
  invitee_name: z.string().min(1, 'invitee_name is required').max(200),
  invitee_email: z.string().email('Valid email is required'),
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

    const { data: eventTypes, error: eventTypesError } = await supabase
      .from('event_types')
      .select('id, title, color, duration_minutes, location_type')
      .eq('project_id', project.id)
      .eq('asset_id', id)
      .eq('is_active', true)
      .order('title');

    if (eventTypesError) throw eventTypesError;

    const { bookings } = await listAssetBookings(supabase, id, { limit: 200 });

    return NextResponse.json({ event_types: eventTypes ?? [], bookings });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
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

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project || project.project_type !== 'community') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await requireAssetAccessManage(supabase, user.id, project.id, id);

    const raw = await request.json();
    const validation = createBookingSchema.safeParse(raw);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const body = validation.data;

    const { data: assetEventTypes, error: eventTypesError } = await supabase
      .from('event_types')
      .select('id')
      .eq('project_id', project.id)
      .eq('asset_id', id)
      .eq('is_active', true);

    if (eventTypesError) throw eventTypesError;

    const assetEventTypeIds = (assetEventTypes ?? []).map((item) => item.id);
    let eventTypeId = body.event_type_id ?? null;

    if (!eventTypeId) {
      if (assetEventTypeIds.length === 1) {
        eventTypeId = assetEventTypeIds[0] ?? null;
      } else {
        return NextResponse.json(
          { error: 'event_type_id is required when an asset has multiple active presets' },
          { status: 400 }
        );
      }
    }

    if (!eventTypeId || !assetEventTypeIds.includes(eventTypeId)) {
      return NextResponse.json({ error: 'Selected event type is not available for this asset' }, { status: 400 });
    }

    const result = await createAssetBooking({
      assetId: id,
      eventTypeId,
      startAt: body.start_at,
      inviteeName: body.invitee_name,
      inviteeEmail: body.invitee_email,
    });

    if (!result.success) {
      const status =
        result.errorCode === 'CAPACITY_EXHAUSTED' ? 409
        : result.errorCode === 'ASSET_NOT_FOUND' || result.errorCode === 'EVENT_TYPE_NOT_FOUND' ? 404
        : result.errorCode === 'ACCESS_DISABLED' || result.errorCode === 'NO_BOOKING_OWNER' ? 400
        : 500;

      return NextResponse.json({ error: result.error ?? 'Failed to create booking' }, { status });
    }

    return NextResponse.json({
      booking: {
        id: result.bookingId,
        status: result.status,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/community-assets/[id]/bookings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

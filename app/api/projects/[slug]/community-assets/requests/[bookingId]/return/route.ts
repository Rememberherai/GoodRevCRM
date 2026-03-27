import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAssetAccessManage } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { markReturnedSchema } from '@/lib/validators/asset-access';
import { markAssetReturned } from '@/lib/asset-access/service';

interface RouteContext {
  params: Promise<{ slug: string; bookingId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, bookingId } = await context.params;
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

    // Load booking to find asset_id
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, project_id, event_types!inner(asset_id)')
      .eq('id', bookingId)
      .eq('project_id', project.id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const eventType = booking.event_types as unknown as { asset_id: string | null };
    const assetId = eventType?.asset_id;

    if (!assetId) {
      return NextResponse.json({ error: 'Booking is not linked to an asset' }, { status: 400 });
    }

    await requireAssetAccessManage(supabase, user.id, project.id, assetId);

    const body = await request.json();
    const validation = markReturnedSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const result = await markAssetReturned(bookingId, user.id, validation.data.notes);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/community-assets/requests/[bookingId]/return:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

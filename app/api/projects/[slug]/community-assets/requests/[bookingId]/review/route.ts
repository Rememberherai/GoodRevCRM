import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAssetAccessManage } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { reviewRequestSchema } from '@/lib/validators/asset-access';
import { reviewAssetBooking } from '@/lib/asset-access/service';
import { sendConfirmedEmail as sendBookingConfirmedNotification, sendDeniedEmail as sendBookingDeniedNotification } from '@/lib/asset-access/notifications';

interface RouteContext {
  params: Promise<{ slug: string; bookingId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
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
      .select('id, project_id, invitee_email, event_types!inner(asset_id)')
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
    const validation = reviewRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { action, notes, expires_at } = validation.data;

    // For grant_access_and_approve, resolve person_id from invitee_email
    let personId: string | undefined;
    if (action === 'grant_access_and_approve') {
      if (!booking.invitee_email) {
        return NextResponse.json(
          { error: 'Booking invitee email is missing. Create or link a contact record first.' },
          { status: 400 }
        );
      }

      const { data: person } = await supabase
        .from('people')
        .select('id')
        .ilike('email', booking.invitee_email)
        .eq('project_id', project.id)
        .maybeSingle();

      if (!person) {
        return NextResponse.json(
          { error: 'No matching person found for invitee email. Create a contact record first.' },
          { status: 400 }
        );
      }
      personId = person.id;
    }

    const result = await reviewAssetBooking({
      bookingId,
      action,
      reviewerUserId: user.id,
      notes,
      personId,
      expires_at,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Send notification (non-blocking)
    try {
      if (action === 'approve' || action === 'grant_access_and_approve') {
        sendBookingConfirmedNotification(bookingId, project.id).catch((e) =>
          console.error('Failed to send booking confirmed notification:', e)
        );
      } else if (action === 'deny') {
        sendBookingDeniedNotification(bookingId, project.id).catch((e) =>
          console.error('Failed to send booking denied notification:', e)
        );
      }
    } catch (notifError) {
      console.error('Error sending review notification:', notifError);
    }

    return NextResponse.json({
      success: true,
      approval_created: action === 'grant_access_and_approve',
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PATCH /api/projects/[slug]/community-assets/requests/[bookingId]/review:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

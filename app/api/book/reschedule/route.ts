import { NextResponse } from 'next/server';
import { rescheduleBookingByTokenSchema } from '@/lib/validators/calendar';
import { rescheduleBookingByToken, checkRateLimit } from '@/lib/calendar/service';
import { createServiceClient } from '@/lib/supabase/server';

// GET /api/book/reschedule?token=xxx — Validate token, return booking info
export async function GET(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateCheck = await checkRateLimit(`ip:reschedule:${ip}`, 20, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, event_type_id, start_at, token_expires_at, status, invitee_name, invitee_email, event_types(title, duration_minutes, user_id)')
      .eq('reschedule_token', token)
      .single();

    if (!booking) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    }

    if (booking.status === 'cancelled' || booking.status === 'rescheduled') {
      return NextResponse.json({ error: 'Booking already cancelled or rescheduled' }, { status: 410 });
    }

    if (booking.token_expires_at && new Date(booking.token_expires_at) < new Date()) {
      return NextResponse.json({ error: 'Token expired' }, { status: 410 });
    }

    const et = booking.event_types as { title: string; duration_minutes: number; user_id: string } | null;

    // Get host display name
    let hostName = '';
    if (et?.user_id) {
      const { data: profile } = await supabase
        .from('calendar_profiles')
        .select('display_name')
        .eq('user_id', et.user_id)
        .single();
      hostName = profile?.display_name || '';
    }

    return NextResponse.json({
      booking: {
        event_type_id: booking.event_type_id,
        event_type_title: et?.title || 'Meeting',
        duration_minutes: et?.duration_minutes || 30,
        host_name: hostName,
        invitee_name: booking.invitee_name,
        invitee_email: booking.invitee_email,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/book/reschedule — Reschedule booking via token
export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateCheck = await checkRateLimit(`ip:reschedule:${ip}`, 20, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const result = rescheduleBookingByTokenSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
    }

    const rescheduleResult = await rescheduleBookingByToken(
      result.data.token,
      result.data.new_start_at
    );

    if (!rescheduleResult.success) {
      const status = rescheduleResult.errorCode === 'SLOT_TAKEN' ? 409 : 400;
      return NextResponse.json(
        { error: rescheduleResult.error, code: rescheduleResult.errorCode },
        { status }
      );
    }

    // Fetch the new booking to return ics_token
    let icsToken = null;
    if (rescheduleResult.newBookingId) {
      const supabase = createServiceClient();
      const { data: newBooking } = await supabase
        .from('bookings')
        .select('ics_token')
        .eq('id', rescheduleResult.newBookingId)
        .single();
      icsToken = newBooking?.ics_token || null;
    }

    return NextResponse.json({
      booking: {
        id: rescheduleResult.newBookingId,
        ics_token: icsToken,
      },
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

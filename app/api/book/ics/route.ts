import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { generateIcs } from '@/lib/calendar/ics';
import { checkRateLimit } from '@/lib/calendar/service';

// GET /api/book/ics?token=<ics_token> — Download .ics file for a booking
export async function GET(request: Request) {
  try {
    // Rate limit by IP to prevent token brute-forcing
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateCheck = await checkRateLimit(`ip:ics:${ip}`, 30, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Look up booking by ics_token, check expiry (end_at)
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*, event_types(title, description, duration_minutes)')
      .eq('ics_token', token)
      .single();

    if (error || !booking) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
    }

    // ics_token expires at end_at (invitee may download during meeting)
    if (new Date(booking.end_at) < new Date()) {
      return NextResponse.json({ error: 'Download link has expired' }, { status: 410 });
    }

    // Load host info
    const { data: profile } = await supabase
      .from('calendar_profiles')
      .select('display_name')
      .eq('user_id', booking.host_user_id)
      .single();

    const { data: hostUser } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', booking.host_user_id)
      .single();

    const hostName = profile?.display_name || hostUser?.full_name || 'Host';
    const eventType = booking.event_types as { title?: string; description?: string; duration_minutes?: number } | null;

    const ics = generateIcs({
      uid: booking.id,
      summary: `${eventType?.title || 'Meeting'} with ${hostName}`,
      description: eventType?.description || undefined,
      location: booking.location || booking.meeting_url || undefined,
      startAt: booking.start_at,
      endAt: booking.end_at,
      organizerName: hostName,
      organizerEmail: hostUser?.email || undefined,
      attendeeName: booking.invitee_name,
      attendeeEmail: booking.invitee_email,
      url: booking.meeting_url || undefined,
    });

    return new NextResponse(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="booking-${booking.id.slice(0, 8)}.ics"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createPublicBookingSchema } from '@/lib/validators/calendar';
import { createBooking, checkRateLimit } from '@/lib/calendar/service';
import { createServiceClient } from '@/lib/supabase/server';

// POST /api/book — Public booking creation (rate-limited, transactional)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = createPublicBookingSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
    }

    // Rate limit by IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const ipLimit = await checkRateLimit(`ip:${ip}`, 10, 60); // 10 per hour
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many booking attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // Rate limit by email
    const emailLimit = await checkRateLimit(
      `email:${result.data.invitee_email}`,
      5,
      1440 // 5 per day
    );
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many bookings for this email. Please try again tomorrow.' },
        { status: 429 }
      );
    }

    const bookingResult = await createBooking({
      eventTypeId: result.data.event_type_id,
      startAt: result.data.start_at,
      inviteeName: result.data.invitee_name,
      inviteeEmail: result.data.invitee_email,
      inviteePhone: result.data.invitee_phone,
      inviteeTimezone: result.data.invitee_timezone,
      inviteeNotes: result.data.invitee_notes,
      responses: result.data.responses,
    });

    if (!bookingResult.success) {
      const status = bookingResult.errorCode === 'SLOT_TAKEN' ? 409 : 400;
      return NextResponse.json({ error: bookingResult.error, code: bookingResult.errorCode }, { status });
    }

    // Fetch ics_token for the confirmation page
    let icsToken = null;
    if (bookingResult.bookingId) {
      const supabase = createServiceClient();
      const { data: newBooking } = await supabase
        .from('bookings')
        .select('ics_token')
        .eq('id', bookingResult.bookingId)
        .single();
      icsToken = newBooking?.ics_token || null;
    }

    return NextResponse.json({
      booking: {
        id: bookingResult.bookingId,
        ics_token: icsToken,
      },
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

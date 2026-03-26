import { NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/scheduler/cron-auth';
import { sendBookingReminders } from '@/lib/calendar/notifications';
import { sendEventReminders } from '@/lib/events/notifications';
import { generateUpcomingSeriesInstances } from '@/lib/events/series';

// POST /api/cron/booking-reminders — Sends 24h and 1h reminders for bookings and events
export async function POST(request: Request) {
  const authorized = await verifyCronAuth(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [bookingResult] = await Promise.all([
      sendBookingReminders(),
      sendEventReminders().catch(err => console.error('Event reminders error:', err)),
      generateUpcomingSeriesInstances().catch(err => console.error('Series generation error:', err)),
    ]);

    return NextResponse.json({
      success: true,
      sent_24h: bookingResult.sent24h,
      sent_1h: bookingResult.sent1h,
    });
  } catch (err) {
    console.error('Booking reminders cron error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Also support GET for cron-job.org
export async function GET(request: Request) {
  return POST(request);
}

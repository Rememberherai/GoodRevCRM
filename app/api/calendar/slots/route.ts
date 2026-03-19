import { NextResponse } from 'next/server';
import { slotQuerySchema } from '@/lib/validators/calendar';
import { getAvailableSlots } from '@/lib/calendar/slots';

// GET /api/calendar/slots?event_type_id=&start_date=&end_date=&timezone=
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const result = slotQuerySchema.safeParse({
      event_type_id: searchParams.get('event_type_id'),
      start_date: searchParams.get('start_date'),
      end_date: searchParams.get('end_date'),
      timezone: searchParams.get('timezone') ?? undefined,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
    }

    const days = await getAvailableSlots({
      eventTypeId: result.data.event_type_id,
      startDate: result.data.start_date,
      endDate: result.data.end_date,
      inviteeTimezone: result.data.timezone,
    });

    return NextResponse.json({ days });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

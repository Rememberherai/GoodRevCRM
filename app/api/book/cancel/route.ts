import { NextResponse } from 'next/server';
import { cancelBookingByTokenSchema } from '@/lib/validators/calendar';
import { cancelBookingByToken, checkRateLimit } from '@/lib/calendar/service';

// POST /api/book/cancel — Cancel booking via token
export async function POST(request: Request) {
  try {
    // Rate limit by IP to prevent token brute-forcing
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateCheck = await checkRateLimit(`ip:cancel:${ip}`, 20, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const result = cancelBookingByTokenSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
    }

    const cancelResult = await cancelBookingByToken(result.data.token, result.data.reason);

    if (!cancelResult.success) {
      const status = cancelResult.error?.includes('expired') ? 410 : 400;
      return NextResponse.json({ error: cancelResult.error || 'Cancellation failed' }, { status });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateBookingStatusSchema } from '@/lib/validators/calendar';
import { cancelBookingByHost } from '@/lib/calendar/service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/calendar/bookings/[id]
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('bookings')
      .select('*, event_types(*)')
      .eq('id', id)
      .eq('host_user_id', user.id)
      .single();

    if (error) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    return NextResponse.json({ booking: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/calendar/bookings/[id] — Update booking status
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const result = updateBookingStatusSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
    }

    if (result.data.status === 'cancelled') {
      const cancelResult = await cancelBookingByHost(id, user.id, result.data.cancellation_reason);
      if (!cancelResult.success) {
        return NextResponse.json({ error: cancelResult.error }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    // Only allow status transitions from active states
    // Prevent reviving cancelled/rescheduled bookings
    const allowedFromStatuses = {
      confirmed: ['pending'],
      completed: ['confirmed'],
      no_show: ['confirmed'],
    } as Record<string, string[]>;

    const validFrom = allowedFromStatuses[result.data.status];

    const { data: updated, error } = await supabase
      .from('bookings')
      .update({ status: result.data.status })
      .eq('id', id)
      .eq('host_user_id', user.id)
      .in('status', validFrom || [])
      .select()
      .single();

    if (error || !updated) return NextResponse.json({ error: 'Booking not found or update failed' }, { status: 404 });
    return NextResponse.json({ booking: updated });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

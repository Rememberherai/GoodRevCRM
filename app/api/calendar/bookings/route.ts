import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/calendar/bookings — List host's bookings
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const status = searchParams.get('status');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

    let query = supabase
      .from('bookings')
      .select('*, event_types(id, title, slug, color, duration_minutes, location_type)', { count: 'exact' })
      .eq('host_user_id', user.id)
      .order('start_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (projectId) query = query.eq('project_id', projectId);
    if (status) {
      const validStatuses = ['pending', 'confirmed', 'cancelled', 'rescheduled', 'completed', 'no_show'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
      }
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ bookings: data, total: count });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

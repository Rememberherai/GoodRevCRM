import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createAvailabilityOverrideSchema } from '@/lib/validators/calendar';

// GET /api/calendar/availability/overrides?start_date=&end_date=
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (startDate && !dateRegex.test(startDate)) {
      return NextResponse.json({ error: 'Invalid start_date format (YYYY-MM-DD)' }, { status: 400 });
    }
    if (endDate && !dateRegex.test(endDate)) {
      return NextResponse.json({ error: 'Invalid end_date format (YYYY-MM-DD)' }, { status: 400 });
    }

    let query = supabase
      .from('availability_overrides')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true });

    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ overrides: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/calendar/availability/overrides
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const result = createAvailabilityOverrideSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
    }

    const { data: override, error } = await supabase
      .from('availability_overrides')
      .insert({ ...result.data, user_id: user.id })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ override }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createAvailabilityScheduleSchema } from '@/lib/validators/calendar';

// GET /api/calendar/availability/schedules
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: schedules, error } = await supabase
      .from('availability_schedules')
      .select('*, availability_rules(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ schedules });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/calendar/availability/schedules — Create with rules
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const result = createAvailabilityScheduleSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
    }

    const { rules, ...scheduleData } = result.data;

    // If setting as default, unset other defaults first
    if (scheduleData.is_default) {
      await supabase
        .from('availability_schedules')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('is_default', true);
    }

    // Create schedule
    const { data: schedule, error: schedError } = await supabase
      .from('availability_schedules')
      .insert({ ...scheduleData, user_id: user.id })
      .select()
      .single();

    if (schedError) return NextResponse.json({ error: schedError.message }, { status: 500 });

    // Create rules
    if (rules && rules.length > 0) {
      const { error: rulesError } = await supabase
        .from('availability_rules')
        .insert(rules.map((r) => ({ ...r, schedule_id: schedule.id })));

      if (rulesError) {
        await supabase
          .from('availability_schedules')
          .delete()
          .eq('id', schedule.id)
          .eq('user_id', user.id);
        return NextResponse.json({ error: rulesError.message }, { status: 500 });
      }
    }

    // Reload with rules
    const { data: full } = await supabase
      .from('availability_schedules')
      .select('*, availability_rules(*)')
      .eq('id', schedule.id)
      .single();

    return NextResponse.json({ schedule: full }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

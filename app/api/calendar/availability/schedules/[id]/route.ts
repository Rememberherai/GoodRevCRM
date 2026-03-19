import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateAvailabilityScheduleSchema } from '@/lib/validators/calendar';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/calendar/availability/schedules/[id]
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('availability_schedules')
      .select('*, availability_rules(*)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    return NextResponse.json({ schedule: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/calendar/availability/schedules/[id]
export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const result = updateAvailabilityScheduleSchema.safeParse(body);
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
        .eq('is_default', true)
        .neq('id', id);
    }

    // Update schedule fields
    if (Object.keys(scheduleData).length > 0) {
      const { error } = await supabase
        .from('availability_schedules')
        .update(scheduleData)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Replace rules if provided
    if (rules !== undefined) {
      // Verify the schedule belongs to this user before touching rules
      const { data: ownerCheck } = await supabase
        .from('availability_schedules')
        .select('id')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (!ownerCheck) {
        return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
      }

      const { data: existingRules, error: existingRulesError } = await supabase
        .from('availability_rules')
        .select('day_of_week, start_time, end_time')
        .eq('schedule_id', id);

      if (existingRulesError) {
        return NextResponse.json({ error: existingRulesError.message }, { status: 500 });
      }

      const { error: deleteRulesError } = await supabase
        .from('availability_rules')
        .delete()
        .eq('schedule_id', id);

      if (deleteRulesError) {
        return NextResponse.json({ error: deleteRulesError.message }, { status: 500 });
      }

      if (rules.length > 0) {
        const { error } = await supabase
          .from('availability_rules')
          .insert(rules.map((r) => ({ ...r, schedule_id: id })));

        if (error) {
          if (existingRules && existingRules.length > 0) {
            await supabase
              .from('availability_rules')
              .insert(existingRules.map((rule) => ({ ...rule, schedule_id: id })));
          }
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
    }

    const { data: full } = await supabase
      .from('availability_schedules')
      .select('*, availability_rules(*)')
      .eq('id', id)
      .single();

    return NextResponse.json({ schedule: full });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/calendar/availability/schedules/[id]
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { error } = await supabase
      .from('availability_schedules')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

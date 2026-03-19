import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { syncCalendarEvents } from '@/lib/calendar/sync';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/calendar/integrations/[id]/sync — manual sync trigger
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify ownership
    const { data: integration } = await supabase
      .from('calendar_integrations')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!integration) return NextResponse.json({ error: 'Integration not found' }, { status: 404 });

    const result = await syncCalendarEvents(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      eventsUpserted: result.eventsUpserted,
      eventsDeleted: result.eventsDeleted,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/scheduler/cron-auth';
import { syncCalendarEvents } from '@/lib/calendar/sync';

// POST /api/cron/calendar-sync
export async function POST(request: Request) {
  const isAuthorized = await verifyCronAuth(request);
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();

    // Fetch all active integrations with sync enabled
    const { data: integrations, error } = await supabase
      .from('calendar_integrations')
      .select('id, user_id, last_synced_at, sync_errors_count')
      .eq('status', 'connected')
      .eq('sync_enabled', true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!integrations || integrations.length === 0) {
      return NextResponse.json({ message: 'No integrations to sync', synced: 0 });
    }

    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const integration of integrations) {
      // Skip if synced within last 5 minutes
      if (integration.last_synced_at) {
        const lastSync = new Date(integration.last_synced_at).getTime();
        if (Date.now() - lastSync < 5 * 60 * 1000) {
          continue;
        }
      }

      // Skip integrations with too many consecutive errors (back off)
      if ((integration.sync_errors_count ?? 0) >= 10) {
        continue;
      }

      const result = await syncCalendarEvents(integration.id);
      results.push({
        id: integration.id,
        success: result.success,
        error: result.error,
      });
    }

    return NextResponse.json({
      message: `Synced ${results.filter(r => r.success).length}/${results.length} integrations`,
      results,
    });
  } catch (err) {
    console.error('Calendar sync cron error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { processDelayedSteps, processScheduledWorkflows } from '@/lib/workflows/delay-processor';
import { verifyCronAuth } from '@/lib/scheduler/cron-auth';
import { createClient } from '@/lib/supabase/server';

/**
 * Cron endpoint to:
 * 1. Process delayed workflow steps that have reached their scheduled time
 * 2. Trigger scheduled workflows whose cron/interval matches
 *
 * Auth: CRON_SECRET bearer token OR session cookie (browser scheduler)
 */
export async function GET(request: Request) {
  const isAuthorized = await verifyCronAuth(request);
  if (!isAuthorized) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // Run both processors in parallel
    const [delayResult, scheduleResult] = await Promise.all([
      processDelayedSteps(),
      processScheduledWorkflows(),
    ]);

    return NextResponse.json({
      success: true,
      delays: delayResult,
      schedules: scheduleResult,
    });
  } catch (error) {
    console.error('Workflow cron processing failed:', error);
    return NextResponse.json(
      { error: 'Processing failed', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

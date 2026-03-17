import { NextResponse } from 'next/server';
import { processDelayedSteps, processScheduledWorkflows } from '@/lib/workflows/delay-processor';

/**
 * Cron endpoint to:
 * 1. Process delayed workflow steps that have reached their scheduled time
 * 2. Trigger scheduled workflows whose cron/interval matches
 *
 * Should be called every minute by Vercel Cron or external scheduler.
 * Protected by CRON_SECRET header.
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

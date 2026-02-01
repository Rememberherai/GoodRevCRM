import { NextResponse } from 'next/server';
import { processSequences } from '@/lib/sequences/processor';

/**
 * Cron endpoint for processing sequence enrollments
 * This should be called periodically (e.g., every minute) to send scheduled emails
 *
 * For Vercel Cron: Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/process-sequences",
 *     "schedule": "* * * * *"
 *   }]
 * }
 */
export async function GET(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Cron] Starting sequence processing...');

    const result = await processSequences(100);

    console.log(
      `[Cron] Sequence processing complete: ${result.processed} processed, ${result.sent} sent, ${result.completed} completed, ${result.errors} errors`
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Cron] Error processing sequences:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export async function POST(request: Request) {
  return GET(request);
}

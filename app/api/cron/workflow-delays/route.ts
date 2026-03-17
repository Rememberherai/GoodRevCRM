import { NextResponse } from 'next/server';
import { processDelayedSteps } from '@/lib/workflows/delay-processor';

/**
 * Cron endpoint to process delayed workflow steps.
 * Should be called every minute by Vercel Cron or external scheduler.
 *
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
    const result = await processDelayedSteps();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Workflow delay processing failed:', error);
    return NextResponse.json(
      { error: 'Processing failed', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

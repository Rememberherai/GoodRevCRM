import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processSequences } from '@/lib/sequences/processor';
import { processTimeTriggers } from '@/lib/automations/time-triggers';
import { verifyCronAuth } from '@/lib/scheduler/cron-auth';

// Vercel Hobby max is 60s; with 3s rate limiting this processes ~20 emails per run
export const maxDuration = 60;

/**
 * Process sequence enrollments and time-based automations.
 * Supports two auth modes:
 *   1. CRON_SECRET bearer token (for Vercel Cron or pg_cron via edge function)
 *   2. Supabase session cookie (for manual "Process Queue" button in UI)
 */
async function processAll() {
  console.log('[Process] Starting sequence processing...');
  const result = await processSequences(18);
  console.log(
    `[Process] Sequence processing complete: ${result.processed} processed, ${result.sent} sent, ${result.completed} completed, ${result.errors} errors`
  );

  let automationResult = null;
  try {
    console.log('[Process] Starting time-based automation processing...');
    automationResult = await processTimeTriggers(200);
    console.log(
      `[Process] Automation processing complete: ${automationResult.processed} processed, ${automationResult.matched} matched, ${automationResult.errors} errors`
    );
  } catch (automationError) {
    console.error('[Process] Error processing automations:', automationError instanceof Error ? automationError.message : 'Unknown error');
  }

  return { sequences: result, automations: automationResult };
}

export async function GET(request: Request) {
  // Try CRON_SECRET auth first (for automated calls — supports per-project secrets)
  const hasCronAuth = await verifyCronAuth(request);

  if (hasCronAuth) {
    try {
      const result = await processAll();
      return NextResponse.json({ success: true, ...result });
    } catch (error) {
      console.error('[Process] Error:', error instanceof Error ? error.message : 'Unknown error');
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  }

  // Fall back to user session auth (for manual trigger from UI)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processAll();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[Process] Error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// Support POST for manual triggering
export async function POST(request: Request) {
  return GET(request);
}

import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { verifyCronAuth } from '@/lib/scheduler/cron-auth';
import { scanConnectionForBounces } from '@/lib/gmail/bounce-scan';

export const maxDuration = 60;

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET /api/cron/bounce-scan
 * Cron-triggered bounce scan for all active Gmail connections.
 * Calls scan logic directly (no self-fetch) to avoid spawning extra function instances.
 */
export async function GET(request: Request) {
  const isAuthorized = await verifyCronAuth(request);
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    const { data: connections, error } = await supabase
      .from('gmail_connections')
      .select('id, email')
      .eq('status', 'connected')
      .eq('sync_enabled', true);

    if (error || !connections?.length) {
      return NextResponse.json({ ok: true, message: 'No active connections', scanned: 0 });
    }

    // Process connections with concurrency limit of 2 to stay within maxDuration
    const results = [];
    for (let i = 0; i < connections.length; i += 2) {
      const batch = connections.slice(i, i + 2);
      const batchResults = await Promise.allSettled(
        batch.map(async (conn) => {
          try {
            const scanResult = await scanConnectionForBounces(conn.id);
            return {
              connection_id: conn.id,
              email: conn.email.replace(/^(.{3}).*@/, '$1***@'),
              ...scanResult,
            };
          } catch (err) {
            return {
              connection_id: conn.id,
              email: conn.email.replace(/^(.{3}).*@/, '$1***@'),
              error: err instanceof Error ? err.message : 'Unknown error',
            };
          }
        })
      );

      for (const r of batchResults) {
        results.push(r.status === 'fulfilled' ? r.value : { error: 'Promise rejected' });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    console.error('[BounceScanCron] Error:', error);
    return NextResponse.json({ error: 'Bounce scan cron failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}

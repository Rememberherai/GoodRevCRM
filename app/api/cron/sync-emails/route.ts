import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { syncEmailsForConnection } from '@/lib/gmail/sync';
import { verifyCronAuth } from '@/lib/scheduler/cron-auth';

export const maxDuration = 60;

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET /api/cron/sync-emails
 * Cron-triggered email sync for all active Gmail connections.
 * This is a fallback for when Pub/Sub push notifications aren't working.
 * Designed to be pinged by cron-job.org every 5-10 minutes.
 *
 * Auth: CRON_SECRET bearer token
 */
export async function GET(request: Request) {
  const isAuthorized = await verifyCronAuth(request);
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    // Fetch all active Gmail connections with sync enabled
    const { data: connections, error } = await supabase
      .from('gmail_connections')
      .select('id, email, last_sync_at, watch_expiration, sync_errors_count')
      .eq('status', 'connected')
      .eq('sync_enabled', true);

    if (error) {
      console.error('[SyncCron] Failed to fetch connections:', error);
      return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 });
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({ ok: true, message: 'No active connections', synced: 0 });
    }

    const results: Array<{
      connection_id: string;
      email: string;
      status: 'synced' | 'skipped' | 'error';
      messages_fetched?: number;
      messages_stored?: number;
      error?: string;
    }> = [];

    for (const conn of connections) {
      // Skip if synced very recently (within last 2 minutes) to avoid redundant work
      if (conn.last_sync_at) {
        const lastSync = new Date(conn.last_sync_at);
        const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000);
        if (lastSync > twoMinAgo) {
          results.push({
            connection_id: conn.id,
            email: conn.email.replace(/^(.{3}).*@/, '$1***@'),
            status: 'skipped',
          });
          continue;
        }
      }

      try {
        const syncResult = await syncEmailsForConnection(conn.id);
        results.push({
          connection_id: conn.id,
          email: conn.email.replace(/^(.{3}).*@/, '$1***@'),
          status: 'synced',
          messages_fetched: syncResult.messages_fetched,
          messages_stored: syncResult.messages_stored,
          error: syncResult.error,
        });
      } catch (err) {
        console.error(`[SyncCron] Sync failed for ${conn.id}:`, err);
        results.push({
          connection_id: conn.id,
          email: conn.email.replace(/^(.{3}).*@/, '$1***@'),
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const synced = results.filter(r => r.status === 'synced').length;
    const totalFetched = results.reduce((sum, r) => sum + (r.messages_fetched ?? 0), 0);
    const totalStored = results.reduce((sum, r) => sum + (r.messages_stored ?? 0), 0);

    console.log(`[SyncCron] Complete: ${synced}/${connections.length} connections synced, ${totalFetched} fetched, ${totalStored} stored`);

    return NextResponse.json({
      ok: true,
      connections_total: connections.length,
      connections_synced: synced,
      messages_fetched: totalFetched,
      messages_stored: totalStored,
      results,
    });
  } catch (error) {
    console.error('[SyncCron] Error:', error);
    return NextResponse.json({
      error: 'Sync cron failed',
    }, { status: 500 });
  }
}

// Support POST for flexibility
export async function POST(request: Request) {
  return GET(request);
}

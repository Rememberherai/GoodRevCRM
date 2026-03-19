import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { verifyCronAuth } from '@/lib/scheduler/cron-auth';

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
 * Searches Gmail for NDR/DSN messages and creates bounce email_events.
 *
 * Auth: per-project cron_secret or CRON_SECRET env var
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

    // Forward auth header + project_id so bounce-scan endpoint accepts the request
    const authHeader = request.headers.get('authorization') ?? '';
    const url = new URL(request.url);
    const baseUrl = url.origin;
    const projectId = url.searchParams.get('project_id') ?? '';
    const results = [];

    for (const conn of connections) {
      try {
        const scanUrl = `${baseUrl}/api/gmail/bounce-scan${projectId ? `?project_id=${projectId}` : ''}`;
        const response = await fetch(scanUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify({ connection_id: conn.id }),
        });

        const data = await response.json();
        results.push({
          connection_id: conn.id,
          email: conn.email.replace(/^(.{3}).*@/, '$1***@'),
          ...data,
        });
      } catch (err) {
        results.push({
          connection_id: conn.id,
          email: conn.email.replace(/^(.{3}).*@/, '$1***@'),
          error: err instanceof Error ? err.message : 'Unknown error',
        });
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

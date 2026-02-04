import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { registerWatch, stopWatch } from '@/lib/gmail/sync';
import type { GmailConnection } from '@/types/gmail';

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST /api/gmail/sync/toggle
 * Enable or disable email sync for a Gmail connection
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { connection_id, enabled } = body;

  if (!connection_id || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'Missing connection_id or enabled' }, { status: 400 });
  }

  // Verify user owns this connection
  const adminClient = createAdminClient();
  const { data: connection, error: connError } = await adminClient
    .from('gmail_connections')
    .select('*')
    .eq('id', connection_id)
    .eq('user_id', user.id)
    .single();

  if (connError || !connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  if (enabled) {
    // Enable sync — register watch
    try {
      const watchResult = await registerWatch(connection as GmailConnection);
      await adminClient
        .from('gmail_connections')
        .update({
          sync_enabled: true,
          watch_expiration: watchResult.expiration,
          history_id: connection.history_id ?? watchResult.historyId,
          sync_errors_count: 0,
          last_sync_error: null,
        })
        .eq('id', connection_id);

      return NextResponse.json({
        ok: true,
        sync_enabled: true,
        watch_expiration: watchResult.expiration,
      });
    } catch (error) {
      return NextResponse.json({
        error: error instanceof Error ? error.message : 'Failed to register watch',
      }, { status: 500 });
    }
  } else {
    // Disable sync — stop watch
    try {
      await stopWatch(connection as GmailConnection);
    } catch {
      // Best effort — continue disabling
    }

    await adminClient
      .from('gmail_connections')
      .update({
        sync_enabled: false,
        watch_expiration: null,
      })
      .eq('id', connection_id);

    return NextResponse.json({ ok: true, sync_enabled: false });
  }
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/gmail/service';
import { registerWatch, stopWatch } from '@/lib/gmail/sync';
import type { GmailConnection } from '@/types/gmail';

const toggleSchema = z.object({
  connection_id: z.string().uuid(),
  enabled: z.boolean(),
});

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request: connection_id (UUID) and enabled (boolean) required' }, { status: 400 });
  }

  const { connection_id, enabled } = parsed.data;

  // Use type assertion since gmail_connections table isn't in generated types yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any;

  // Verify user owns this connection using user-scoped client (RLS enforced)
  const { data: connection, error: connError } = await supabaseAny
    .from('gmail_connections')
    .select('id, user_id, email, access_token, refresh_token, token_expires_at, sync_enabled, history_id, watch_expiration')
    .eq('id', connection_id)
    .single();

  if (connError || !connection || connection.user_id !== user.id) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  const adminClient = createAdminClient();

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
      console.error('[Gmail Sync Toggle] registerWatch failed:', error);
      return NextResponse.json({
        error: 'Failed to enable sync. Please try reconnecting your Gmail account.',
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

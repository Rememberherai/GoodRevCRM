import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { EmailSyncStatus } from '@/types/gmail';

interface ConnectionRow {
  id: string;
  email: string;
  sync_enabled: boolean;
  initial_sync_done: boolean;
  last_sync_at: string | null;
  sync_errors_count: number;
  last_sync_error: string | null;
  watch_expiration: string | null;
  status: string;
}

/**
 * GET /api/gmail/sync/status
 * Returns sync status for all of the authenticated user's Gmail connections
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('gmail_connections')
    .select('id, email, sync_enabled, initial_sync_done, last_sync_at, sync_errors_count, last_sync_error, watch_expiration, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const connections = (data as unknown as ConnectionRow[]) ?? [];

  return NextResponse.json({
    connections: connections.map((c): EmailSyncStatus & { status: string } => ({
      connection_id: c.id,
      email: c.email,
      sync_enabled: c.sync_enabled ?? false,
      initial_sync_done: c.initial_sync_done ?? false,
      last_sync_at: c.last_sync_at,
      sync_errors_count: c.sync_errors_count ?? 0,
      last_sync_error: c.last_sync_error,
      watch_expiration: c.watch_expiration,
      status: c.status,
    })),
  });
}

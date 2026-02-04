import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { syncEmailsForConnection } from '@/lib/gmail/sync';

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST /api/gmail/sync/trigger
 * Manually trigger an email sync for a Gmail connection
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { connection_id } = body;

  if (!connection_id) {
    return NextResponse.json({ error: 'Missing connection_id' }, { status: 400 });
  }

  // Verify user owns this connection
  const adminClient = createAdminClient();
  const { data: connection, error: connError } = await adminClient
    .from('gmail_connections')
    .select('id, user_id, status')
    .eq('id', connection_id)
    .eq('user_id', user.id)
    .single();

  if (connError || !connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  if (connection.status !== 'connected') {
    return NextResponse.json({ error: 'Connection is not active' }, { status: 400 });
  }

  try {
    const result = await syncEmailsForConnection(connection_id);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Sync failed',
    }, { status: 500 });
  }
}

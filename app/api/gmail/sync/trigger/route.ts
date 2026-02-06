import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { syncEmailsForConnection } from '@/lib/gmail/sync';
import { z } from 'zod';

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const triggerSyncSchema = z.object({
  connection_id: z.string().uuid(),
});

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = triggerSyncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid or missing connection_id' }, { status: 400 });
  }

  const { connection_id } = parsed.data;


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
    console.error('Sync trigger error:', error);
    return NextResponse.json({
      error: 'Sync failed. Please try again later.',
    }, { status: 500 });
  }
}

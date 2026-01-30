import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { disconnectGmailSchema } from '@/lib/validators/gmail';
import { revokeToken } from '@/lib/gmail/oauth';

// POST /api/gmail/disconnect - Disconnect a Gmail account
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = disconnectGmailSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { connection_id } = validationResult.data;

    // Use type assertion since table isn't in generated types yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Verify ownership and get connection
    const { data: connection, error: fetchError } = await supabaseAny
      .from('gmail_connections')
      .select('id, access_token, refresh_token')
      .eq('id', connection_id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Revoke tokens with Google
    try {
      if (connection.access_token) {
        await revokeToken(connection.access_token);
      }
    } catch (error) {
      console.warn('Failed to revoke token:', error);
      // Continue with deletion even if revoke fails
    }

    // Delete the connection
    const { error: deleteError } = await supabaseAny
      .from('gmail_connections')
      .delete()
      .eq('id', connection_id);

    if (deleteError) {
      console.error('Error deleting Gmail connection:', deleteError);
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/gmail/disconnect:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

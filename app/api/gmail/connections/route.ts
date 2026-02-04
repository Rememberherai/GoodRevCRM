import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/gmail/connections - Get user's Gmail connections
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use type assertion since table isn't in generated types yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { data: connections, error } = await supabaseAny
      .from('gmail_connections')
      .select('id, email, status, last_sync_at, error_message, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching Gmail connections:', error);
      return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 });
    }

    return NextResponse.json({ connections: connections ?? [] });
  } catch (error) {
    console.error('Error in GET /api/gmail/connections:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

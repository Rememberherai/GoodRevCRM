import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { gmailConnectionQuerySchema } from '@/lib/validators/gmail';

// GET /api/gmail/connections - Get user's Gmail connections
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryResult = gmailConnectionQuerySchema.safeParse({
      project_id: searchParams.get('project_id') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    // Use type assertion since table isn't in generated types yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    let query = supabaseAny
      .from('gmail_connections')
      .select('id, project_id, email, status, last_sync_at, error_message, created_at, updated_at')
      .eq('user_id', user.id);

    if (queryResult.data.project_id) {
      query = query.eq('project_id', queryResult.data.project_id);
    }

    const { data: connections, error } = await query.order('created_at', { ascending: false });

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

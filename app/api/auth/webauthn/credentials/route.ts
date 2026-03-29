import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

// GET /api/auth/webauthn/credentials
// Returns the authenticated user's registered passkeys.
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any)
      .from('webauthn_credentials')
      .select('id, device_name, created_at, last_used_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching webauthn credentials:', error);
      return NextResponse.json({ error: 'Failed to fetch credentials' }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error('Error in GET /api/auth/webauthn/credentials:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

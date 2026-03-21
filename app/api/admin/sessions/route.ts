import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSystemAdmin } from '@/lib/admin/permissions';
import { getActiveSessions } from '@/lib/admin/queries';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await requireSystemAdmin(user.id);

    const sessions = await getActiveSessions(user.id);
    return NextResponse.json({ sessions });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) {
      const e = err as { message: string; status: number };
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('[admin/sessions] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

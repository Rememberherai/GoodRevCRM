import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSystemAdmin } from '@/lib/admin/permissions';
import { listUsers } from '@/lib/admin/queries';
import { adminUserListSchema } from '@/lib/admin/validators';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await requireSystemAdmin(user.id);

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const params = adminUserListSchema.parse(searchParams);
    const result = await listUsers(params);
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) {
      const e = err as { message: string; status: number };
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('[admin/users] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

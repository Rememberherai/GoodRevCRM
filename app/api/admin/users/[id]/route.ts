import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSystemAdmin, logAdminAction } from '@/lib/admin/permissions';
import { getUserDetail } from '@/lib/admin/queries';
import { adminUserActionSchema } from '@/lib/admin/validators';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await requireSystemAdmin(user.id);

    const detail = await getUserDetail(id);
    if (!detail) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    return NextResponse.json(detail);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) {
      const e = err as { message: string; status: number };
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await requireSystemAdmin(user.id);

    if (id === user.id) {
      return NextResponse.json({ error: 'Cannot modify your own account' }, { status: 400 });
    }

    const body = await request.json();
    const { action } = adminUserActionSchema.parse(body);
    const adminClient = createAdminClient();

    if (action === 'deactivate') {
      const { error } = await adminClient.auth.admin.updateUserById(id, {
        ban_duration: '876000h',
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await logAdminAction(user.id, 'deactivated_user', 'user', id, {}, request);
    } else if (action === 'reactivate') {
      const { error } = await adminClient.auth.admin.updateUserById(id, {
        ban_duration: 'none',
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await logAdminAction(user.id, 'reactivated_user', 'user', id, {}, request);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) {
      const e = err as { message: string; status: number };
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSystemAdmin, logAdminAction } from '@/lib/admin/permissions';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await requireSystemAdmin(user.id);

    const adminClient = createAdminClient();

    // Find active session
    const { data: session } = await adminClient
      .from('system_admin_sessions')
      .select('id, membership_id')
      .eq('admin_user_id', user.id)
      .eq('project_id', id)
      .is('exited_at', null)
      .single();

    if (!session) {
      // Idempotent — no active session, just return success
      return NextResponse.json({ success: true });
    }

    // Close the session
    await adminClient
      .from('system_admin_sessions')
      .update({ exited_at: new Date().toISOString() })
      .eq('id', session.id);

    // Check if membership was created by admin (not pre-existing)
    // We determine this by checking if there are other sessions for this membership
    // If no other sessions reference this membership, and membership was created during admin enter,
    // we should delete it. For simplicity, we check the membership role — admin-created ones are 'owner'.
    // But a real owner would also be 'owner', so we need a different heuristic.
    // For now, we DON'T delete the membership to be safe. The admin can manually leave the project.

    await logAdminAction(user.id, 'exited_project', 'project', id, {}, request);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) {
      const e = err as { message: string; status: number };
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

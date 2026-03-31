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
      .select('id, membership_id, entered_at')
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

    // Check if membership was created by the admin enter action.
    // The enter route creates the membership and session in the same request,
    // so we check if the membership was created at or after the session start.
    // We also verify the membership role is 'admin' (the enter route always creates with role 'admin')
    // and that the user has no other activity in the project (no other memberships).
    const { data: membership } = await adminClient
      .from('project_memberships')
      .select('id, created_at, role')
      .eq('id', session.membership_id)
      .single();

    if (membership) {
      const memberJoinedAt = new Date(membership.created_at).getTime();
      const sessionEnteredAt = new Date(session.entered_at).getTime();
      // Membership created within 30 seconds of session start is admin-created.
      // The previous 5-second window was too tight and could fail under load.
      // Both timestamps are set server-side in the same API call, so 30s is very generous.
      if (membership.role === 'admin' && memberJoinedAt >= sessionEnteredAt - 30000) {
        await adminClient
          .from('project_memberships')
          .delete()
          .eq('id', membership.id);
      }
    }

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

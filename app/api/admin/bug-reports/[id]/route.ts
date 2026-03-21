import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSystemAdmin, logAdminAction } from '@/lib/admin/permissions';
import { adminBugReportUpdateSchema } from '@/lib/admin/validators';

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

    const body = await request.json();
    const updates = adminBugReportUpdateSchema.parse(body);
    const adminClient = createAdminClient();

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.assigned_to !== undefined) updateData.assigned_to = updates.assigned_to;
    if (updates.admin_notes !== undefined) updateData.admin_notes = updates.admin_notes;
    if (updates.resolution_notes !== undefined) updateData.resolution_notes = updates.resolution_notes;

    // Set resolved_at when status changes to resolved
    if (updates.status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
    }

    const { error } = await adminClient
      .from('bug_reports')
      .update(updateData)
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logAdminAction(user.id, 'updated_bug_report', 'bug_report', id, updates, request);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) {
      const e = err as { message: string; status: number };
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

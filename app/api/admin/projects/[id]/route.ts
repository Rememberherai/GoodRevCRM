import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSystemAdmin, logAdminAction } from '@/lib/admin/permissions';
import { getProjectDetail } from '@/lib/admin/queries';
import { adminProjectActionSchema } from '@/lib/admin/validators';

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

    const detail = await getProjectDetail(id);
    if (!detail) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
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

    const body = await request.json();
    const parsed = adminProjectActionSchema.parse(body);
    const adminClient = createAdminClient();

    if (parsed.action === 'soft_delete') {
      // Verify confirm_name matches
      const { data: project } = await adminClient.from('projects').select('name').eq('id', id).single();
      if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      if (parsed.confirm_name !== project.name) {
        return NextResponse.json({ error: 'Project name does not match' }, { status: 400 });
      }
      await adminClient.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      await logAdminAction(user.id, 'soft_deleted_project', 'project', id, { name: project.name }, request);
    } else if (parsed.action === 'restore') {
      await adminClient.from('projects').update({ deleted_at: null }).eq('id', id);
      await logAdminAction(user.id, 'restored_project', 'project', id, {}, request);
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

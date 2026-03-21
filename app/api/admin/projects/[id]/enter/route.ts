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

    // Check project exists
    const { data: project } = await adminClient.from('projects').select('id, slug, name').eq('id', id).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Check for existing active session
    const { data: existingSession } = await adminClient
      .from('system_admin_sessions')
      .select('id')
      .eq('admin_user_id', user.id)
      .eq('project_id', id)
      .is('exited_at', null)
      .single();

    if (existingSession) {
      return NextResponse.json({ slug: project.slug, already_member: true, existing_session: true });
    }

    // Check if already a member
    const { data: existingMembership } = await adminClient
      .from('project_memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('project_id', id)
      .single();

    const alreadyMember = !!existingMembership;
    let membershipId = existingMembership?.id;

    // Create membership if not already a member
    if (!alreadyMember) {
      const { data: newMembership, error: memberError } = await adminClient
        .from('project_memberships')
        .insert({ user_id: user.id, project_id: id, role: 'owner' })
        .select('id')
        .single();
      if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });
      membershipId = newMembership!.id;
    }

    // Create admin session
    await adminClient.from('system_admin_sessions').insert({
      admin_user_id: user.id,
      project_id: id,
      membership_id: membershipId!,
    });

    await logAdminAction(user.id, 'entered_project', 'project', id, {
      project_name: project.name,
      already_member: alreadyMember,
    }, request);

    return NextResponse.json({ slug: project.slug, already_member: alreadyMember });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) {
      const e = err as { message: string; status: number };
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateMemberRoleSchema } from '@/lib/validators/user';

interface RouteContext {
  params: Promise<{ slug: string; userId: string }>;
}

// GET /api/projects/[slug]/members/[userId] - Get member details
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, userId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { data: member, error } = await supabaseAny
      .from('project_memberships')
      .select('*, user:users!project_memberships_user_id_fkey(id, full_name, email, avatar_url)')
      .eq('project_id', project.id)
      .eq('user_id', userId)
      .single();

    if (error || !member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    return NextResponse.json(member);
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/members/[userId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/members/[userId] - Update member role
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, userId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (userId === user.id) {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validationResult = updateMemberRoleSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Use RPC function to update role (handles permission checks)
    const { data: success, error } = await supabaseAny.rpc('update_member_role', {
      p_project_id: project.id,
      p_user_id: userId,
      p_new_role: validationResult.data.role,
    });

    if (error) {
      console.error('Error updating member role:', error);
      return NextResponse.json({ error: 'Failed to update member role' }, { status: 500 });
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Cannot update member role. Check permissions.' },
        { status: 403 }
      );
    }

    // Get updated member
    const { data: member } = await supabaseAny
      .from('project_memberships')
      .select('*, user:users!project_memberships_user_id_fkey(id, full_name, email, avatar_url)')
      .eq('project_id', project.id)
      .eq('user_id', userId)
      .single();

    return NextResponse.json(member);
  } catch (error) {
    console.error('Error in PATCH /api/projects/[slug]/members/[userId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/members/[userId] - Remove member
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, userId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Check permissions
    const { data: currentMember } = await supabaseAny
      .from('project_memberships')
      .select('role')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single();

    if (!currentMember || !['owner', 'admin'].includes(currentMember.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Admin role required.' },
        { status: 403 }
      );
    }

    // Check target member
    const { data: targetMember } = await supabaseAny
      .from('project_memberships')
      .select('role')
      .eq('project_id', project.id)
      .eq('user_id', userId)
      .single();

    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Can't remove owner
    if (targetMember.role === 'owner') {
      return NextResponse.json({ error: 'Cannot remove project owner' }, { status: 403 });
    }

    // Admins can't remove other admins
    if (currentMember.role === 'admin' && targetMember.role === 'admin') {
      return NextResponse.json({ error: 'Admins cannot remove other admins' }, { status: 403 });
    }

    const { error } = await supabaseAny
      .from('project_memberships')
      .delete()
      .eq('project_id', project.id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error removing member:', error);
      return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error in DELETE /api/projects/[slug]/members/[userId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

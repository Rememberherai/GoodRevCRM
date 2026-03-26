import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ slug: string; userId: string; resource: string }>;
}

// DELETE /api/projects/[slug]/members/[userId]/overrides/[resource] - Remove a single override
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, userId, resource } = await context.params;
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

    // Fetch caller and target membership in parallel
    const [{ data: callerMembership }, { data: targetMembership }] = await Promise.all([
      supabaseAny
        .from('project_memberships')
        .select('role')
        .eq('project_id', project.id)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabaseAny
        .from('project_memberships')
        .select('role')
        .eq('project_id', project.id)
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    if (!callerMembership || !['owner', 'admin'].includes(callerMembership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions. Admin role required.' }, { status: 403 });
    }

    if (!targetMembership) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    if (targetMembership.role === 'owner') {
      return NextResponse.json({ error: 'Cannot modify overrides for project owner' }, { status: 403 });
    }

    if (callerMembership.role === 'admin' && targetMembership.role === 'admin') {
      return NextResponse.json({ error: 'Admins cannot modify overrides for other admins' }, { status: 403 });
    }

    const { error, count } = await supabaseAny
      .from('project_membership_overrides')
      .delete({ count: 'exact' })
      .eq('project_id', project.id)
      .eq('user_id', userId)
      .eq('resource', resource);

    if (error) {
      console.error('Error deleting override:', error);
      return NextResponse.json({ error: 'Failed to delete override' }, { status: 500 });
    }

    if (count === 0) {
      return NextResponse.json({ error: 'Override not found' }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error in DELETE /api/projects/[slug]/members/[userId]/overrides/[resource]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

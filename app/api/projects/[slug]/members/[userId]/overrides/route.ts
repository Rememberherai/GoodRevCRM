import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { upsertOverrideSchema } from '@/lib/validators/user';

interface RouteContext {
  params: Promise<{ slug: string; userId: string }>;
}

// GET /api/projects/[slug]/members/[userId]/overrides - List overrides for a member
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

    // Caller must be owner or admin (or viewing their own overrides)
    const { data: callerMembership } = await supabaseAny
      .from('project_memberships')
      .select('role')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .maybeSingle();

    const isAdminOrOwner = callerMembership && ['owner', 'admin'].includes(callerMembership.role);
    const isSelf = user.id === userId;

    if (!isAdminOrOwner && !isSelf) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { data: overrides, error } = await supabaseAny
      .from('project_membership_overrides')
      .select('id, resource, granted, created_at, updated_at')
      .eq('project_id', project.id)
      .eq('user_id', userId)
      .order('resource');

    if (error) {
      console.error('Error fetching overrides:', error);
      return NextResponse.json({ error: 'Failed to fetch overrides' }, { status: 500 });
    }

    return NextResponse.json(overrides ?? []);
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/members/[userId]/overrides:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/members/[userId]/overrides - Upsert a single override
export async function POST(request: Request, context: RouteContext) {
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

    // Cannot set overrides on owners
    if (targetMembership.role === 'owner') {
      return NextResponse.json({ error: 'Cannot set overrides on project owner' }, { status: 403 });
    }

    // Admins cannot set overrides on other admins — only owners can
    if (callerMembership.role === 'admin' && targetMembership.role === 'admin') {
      return NextResponse.json({ error: 'Admins cannot set overrides on other admins' }, { status: 403 });
    }

    const body = await request.json();
    const validation = upsertOverrideSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { resource, granted } = validation.data;

    const { data: override, error } = await supabaseAny
      .from('project_membership_overrides')
      .upsert(
        { project_id: project.id, user_id: userId, resource, granted },
        { onConflict: 'project_id,user_id,resource' }
      )
      .select('id, resource, granted, created_at, updated_at')
      .single();

    if (error) {
      console.error('Error upserting override:', error);
      return NextResponse.json({ error: 'Failed to save override' }, { status: 500 });
    }

    return NextResponse.json(override, { status: 200 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/members/[userId]/overrides:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { invitationQuerySchema } from '@/lib/validators/user';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/invitations - List invitations
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
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

    // Check if user is admin or owner
    const { data: membership } = await supabaseAny
      .from('project_members')
      .select('role')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Admin role required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const queryResult = invitationQuerySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { status, limit, offset } = queryResult.data;

    let query = supabaseAny
      .from('project_invitations')
      .select('*, inviter:users!project_invitations_invited_by_fkey(id, full_name, email)')
      .eq('project_id', project.id);

    const now = new Date().toISOString();

    if (status === 'pending') {
      query = query.is('accepted_at', null).gt('expires_at', now);
    } else if (status === 'accepted') {
      query = query.not('accepted_at', 'is', null);
    } else if (status === 'expired') {
      query = query.is('accepted_at', null).lt('expires_at', now);
    }

    const { data: invitations, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching invitations:', error);
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
    }

    return NextResponse.json({
      invitations: invitations ?? [],
      pagination: { limit, offset },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/invitations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

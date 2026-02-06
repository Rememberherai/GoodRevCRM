import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { inviteMemberSchema, memberQuerySchema } from '@/lib/validators/user';
import { randomBytes } from 'crypto';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/members - List project members
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

    const { searchParams } = new URL(request.url);
    const queryResult = memberQuerySchema.safeParse({
      role: searchParams.get('role') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { role, search, limit, offset } = queryResult.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Use SECURITY DEFINER RPC to bypass users-table RLS
    const { data: rpcMembers, error } = await supabaseAny.rpc(
      'get_project_memberships',
      { p_project_id: project.id }
    );

    if (error) {
      console.error('Error fetching members:', error);
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }

    // Reshape RPC flat rows into nested { role, user: {...} } format for client compatibility
    let members = (rpcMembers ?? []).map((m: any) => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      joined_at: m.joined_at,
      user: {
        id: m.user_id,
        full_name: m.full_name,
        email: m.email,
        avatar_url: m.avatar_url,
      },
    }));

    // Apply filters
    if (role) {
      members = members.filter((m: any) => m.role === role);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      members = members.filter(
        (m: any) =>
          m.user?.full_name?.toLowerCase().includes(searchLower) ||
          m.user?.email?.toLowerCase().includes(searchLower)
      );
    }

    // Apply pagination
    const paginated = members.slice(offset, offset + limit);

    return NextResponse.json({
      members: paginated,
      pagination: { limit, offset },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/members:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/members - Invite a new member
export async function POST(request: Request, context: RouteContext) {
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
      .from('project_memberships')
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

    const body = await request.json();
    const validationResult = inviteMemberSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { email, role } = validationResult.data;

    // Check if user is already a member
    const { data: existingUser } = await supabaseAny
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      const { data: existingMember } = await supabaseAny
        .from('project_memberships')
        .select('id')
        .eq('project_id', project.id)
        .eq('user_id', existingUser.id)
        .single();

      if (existingMember) {
        return NextResponse.json({ error: 'User is already a member' }, { status: 409 });
      }
    }

    // Check for existing pending invitation
    const { data: existingInvitation } = await supabaseAny
      .from('project_invitations')
      .select('id')
      .eq('project_id', project.id)
      .eq('email', email)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existingInvitation) {
      return NextResponse.json({ error: 'Invitation already sent' }, { status: 409 });
    }

    // Create invitation
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const { data: invitation, error } = await supabaseAny
      .from('project_invitations')
      .insert({
        project_id: project.id,
        email,
        role,
        invited_by: user.id,
        token,
        expires_at: expiresAt.toISOString(),
      })
      .select('id, project_id, email, role, invited_by, expires_at, created_at')
      .single();

    if (error) {
      console.error('Error creating invitation:', error);
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
    }

    // TODO: Send invitation email

    return NextResponse.json(invitation, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/members:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

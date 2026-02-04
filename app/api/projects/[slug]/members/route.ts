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

    // Use RPC function to get members with user info
    let query = supabaseAny
      .from('project_memberships')
      .select('*, user:users!project_memberships_user_id_fkey(id, full_name, email, avatar_url)')
      .eq('project_id', project.id);

    if (role) {
      query = query.eq('role', role);
    }

    const { data: members, error } = await query
      .order('role', { ascending: true })
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching members:', error);
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }

    // Filter by search if provided
    let filteredMembers = members ?? [];
    if (search) {
      const searchLower = search.toLowerCase();
      filteredMembers = filteredMembers.filter(
        (m: { user: { full_name?: string; email?: string } }) =>
          m.user?.full_name?.toLowerCase().includes(searchLower) ||
          m.user?.email?.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json({
      members: filteredMembers,
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
      .select()
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

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { addEventTypeMemberSchema } from '@/lib/validators/calendar';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/calendar/event-types/[id]/members — list members
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify event type ownership
    const { data: eventType } = await supabase
      .from('event_types')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!eventType) return NextResponse.json({ error: 'Event type not found' }, { status: 404 });

    const serviceClient = createServiceClient();
    const { data: members, error } = await serviceClient
      .from('event_type_members')
      .select('id, event_type_id, user_id, is_active, priority, created_at')
      .eq('event_type_id', id)
      .order('priority', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Load user details for each member
    const userIds = (members || []).map((m) => m.user_id);
    const { data: users } = await serviceClient
      .from('users')
      .select('id, full_name, email, avatar_url')
      .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

    const userMap = new Map((users || []).map((u) => [u.id, u]));

    const membersWithUsers = (members || []).map((m) => ({
      ...m,
      user: userMap.get(m.user_id) || { id: m.user_id, full_name: 'Unknown', email: '', avatar_url: null },
    }));

    return NextResponse.json({ members: membersWithUsers });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/calendar/event-types/[id]/members — add a member
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify event type ownership and get project_id
    const { data: eventType } = await supabase
      .from('event_types')
      .select('id, project_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!eventType) return NextResponse.json({ error: 'Event type not found' }, { status: 404 });

    const body = await request.json();
    const parsed = addEventTypeMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    }

    // Verify the user being added is a project member
    const serviceClient = createServiceClient();
    const { data: membership } = await serviceClient
      .from('project_memberships')
      .select('id')
      .eq('project_id', eventType.project_id)
      .eq('user_id', parsed.data.user_id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'User is not a member of this project' }, { status: 400 });
    }

    const { data: member, error } = await serviceClient
      .from('event_type_members')
      .insert({
        event_type_id: id,
        user_id: parsed.data.user_id,
        priority: parsed.data.priority,
      })
      .select('id, event_type_id, user_id, is_active, priority, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'User is already a member of this event type' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ member }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

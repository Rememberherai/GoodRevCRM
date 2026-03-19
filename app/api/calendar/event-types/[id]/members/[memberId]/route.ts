import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateEventTypeMemberSchema } from '@/lib/validators/calendar';

interface RouteContext {
  params: Promise<{ id: string; memberId: string }>;
}

// PATCH /api/calendar/event-types/[id]/members/[memberId] — update member
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id, memberId } = await context.params;
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

    const body = await request.json();
    const parsed = updateEventTypeMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    }

    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const serviceClient = createServiceClient();
    const { data: member, error } = await serviceClient
      .from('event_type_members')
      .update(parsed.data)
      .eq('id', memberId)
      .eq('event_type_id', id)
      .select('id, event_type_id, user_id, is_active, priority, created_at')
      .single();

    if (error || !member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    return NextResponse.json({ member });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/calendar/event-types/[id]/members/[memberId] — remove member
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id, memberId } = await context.params;
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
    const { error } = await serviceClient
      .from('event_type_members')
      .delete()
      .eq('id', memberId)
      .eq('event_type_id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

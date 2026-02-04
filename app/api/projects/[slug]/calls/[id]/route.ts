import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateCallDispositionSchema } from '@/lib/validators/call';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/calls/[id] - Get a single call
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: call, error } = await (supabase as any)
      .from('calls')
      .select(`
        *,
        person:people!calls_person_id_fkey(id, first_name, last_name, email),
        organization:organizations!calls_organization_id_fkey(id, name),
        user:users!calls_user_id_fkey(id, full_name, email, avatar_url)
      `)
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (error || !call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    return NextResponse.json({ call });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/calls/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/calls/[id] - Update call disposition
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const validationResult = updateCallDispositionSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const input = validationResult.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { data: call, error } = await supabaseAny
      .from('calls')
      .update({
        disposition: input.disposition,
        disposition_notes: input.disposition_notes ?? null,
      })
      .eq('id', id)
      .eq('project_id', project.id)
      .select('*')
      .single();

    if (error || !call) {
      console.error('Error updating call disposition:', error);
      return NextResponse.json({ error: 'Failed to update call' }, { status: 500 });
    }

    // Create follow-up task if requested
    if (input.follow_up_date && input.follow_up_title) {
      await supabaseAny.from('tasks').insert({
        project_id: project.id,
        title: input.follow_up_title,
        due_date: input.follow_up_date,
        assigned_to: user.id,
        created_by: user.id,
        status: 'pending',
        source_type: 'call',
        metadata: { call_id: call.id },
        ...(call.person_id ? { person_id: call.person_id } : {}),
        ...(call.organization_id ? { organization_id: call.organization_id } : {}),
      });
    }

    // Update the activity_log entry for this call with disposition
    if (call.person_id) {
      await supabaseAny
        .from('activity_log')
        .update({
          outcome: input.disposition === 'quality_conversation' ? 'quality_conversation'
            : input.disposition === 'meeting_booked' ? 'meeting_booked'
            : input.disposition === 'left_voicemail' ? 'call_left_message'
            : input.disposition === 'no_answer' ? 'call_no_answer'
            : input.disposition === 'not_interested' ? 'not_interested'
            : 'other',
          notes: input.disposition_notes,
        })
        .eq('project_id', project.id)
        .eq('activity_type', 'call')
        .contains('metadata', { call_id: call.id });
    }

    // Emit automation event for disposition
    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'call.dispositioned' as 'entity.updated',
      entityType: 'call' as 'person',
      entityId: call.id,
      data: {
        call_id: call.id,
        disposition: call.disposition,
        person_id: call.person_id,
        organization_id: call.organization_id,
        direction: call.direction,
      },
    }).catch((err) => console.error('Error emitting disposition event:', err));

    return NextResponse.json({ call });
  } catch (error) {
    console.error('Error in PATCH /api/projects/[slug]/calls/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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

// PATCH /api/projects/[slug]/calls/[id] - Update call (disposition or Telnyx IDs)
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Check if this is a Telnyx ID update (from WebRTC client)
    if (body.telnyx_call_control_id !== undefined) {
      const telnyxUpdate: Record<string, unknown> = {};
      if (body.telnyx_call_control_id) telnyxUpdate.telnyx_call_control_id = body.telnyx_call_control_id;
      if (body.telnyx_call_leg_id) telnyxUpdate.telnyx_call_leg_id = body.telnyx_call_leg_id;
      if (body.telnyx_call_session_id) telnyxUpdate.telnyx_call_session_id = body.telnyx_call_session_id;

      if (Object.keys(telnyxUpdate).length > 0) {
        const { data: call, error } = await supabaseAny
          .from('calls')
          .update(telnyxUpdate)
          .eq('id', id)
          .eq('project_id', project.id)
          .select('id')
          .single();

        if (error) {
          console.error('Error updating call Telnyx IDs:', error);
          return NextResponse.json({ error: 'Failed to update call' }, { status: 500 });
        }

        return NextResponse.json({ call });
      }
    }

    // Check if this is a status update (from hangup)
    if (body.status !== undefined && body.ended_at !== undefined) {
      // Calculate duration if we have started_at
      const { data: existingCall } = await supabaseAny
        .from('calls')
        .select('started_at, answered_at')
        .eq('id', id)
        .eq('project_id', project.id)
        .single();

      const statusUpdate: Record<string, unknown> = {
        status: body.status,
        ended_at: body.ended_at,
      };

      if (existingCall?.started_at) {
        const startedAt = new Date(existingCall.started_at);
        const endedAt = new Date(body.ended_at);
        statusUpdate.duration_seconds = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);

        if (existingCall.answered_at) {
          const answeredAt = new Date(existingCall.answered_at);
          statusUpdate.talk_time_seconds = Math.round((endedAt.getTime() - answeredAt.getTime()) / 1000);
        }
      }

      const { data: call, error } = await supabaseAny
        .from('calls')
        .update(statusUpdate)
        .eq('id', id)
        .eq('project_id', project.id)
        .select('id')
        .single();

      if (error) {
        console.error('Error updating call status:', error);
        return NextResponse.json({ error: 'Failed to update call' }, { status: 500 });
      }

      return NextResponse.json({ call });
    }

    // Otherwise, handle disposition update
    const validationResult = updateCallDispositionSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const input = validationResult.data;

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

    // Create or update activity_log entry for this call
    console.log('[Disposition] Checking activity log creation. call.person_id:', call.person_id);
    if (call.person_id) {
      // Map disposition to activity outcome
      const outcomeMap: Record<string, string> = {
        quality_conversation: 'quality_conversation',
        meeting_booked: 'meeting_booked',
        left_voicemail: 'call_left_message',
        no_answer: 'call_no_answer',
        not_interested: 'not_interested',
        busy: 'call_no_answer',
        wrong_number: 'other',
        call_back_later: 'other',
        do_not_call: 'not_interested',
        other: 'other',
      };
      const outcome = outcomeMap[input.disposition] || 'other';

      // Check if activity already exists for this call
      const { data: existingActivity } = await supabaseAny
        .from('activity_log')
        .select('id')
        .eq('activity_type', 'call')
        .contains('metadata', { call_id: call.id })
        .single();

      if (existingActivity) {
        // Update existing activity
        console.log('[Disposition] Updating existing activity:', existingActivity.id);
        const { error: updateErr } = await supabaseAny
          .from('activity_log')
          .update({
            outcome,
            notes: input.disposition_notes,
          })
          .eq('id', existingActivity.id);
        if (updateErr) {
          console.error('[Disposition] Error updating activity:', updateErr);
        }
      } else {
        // Create new activity entry
        const directionLabel = call.direction === 'outbound' ? 'Outbound' : 'Inbound';
        const durationMinutes = call.talk_time_seconds
          ? Math.ceil(call.talk_time_seconds / 60)
          : 0;

        console.log('[Disposition] Creating new activity for person:', call.person_id);
        const { error: insertErr } = await supabaseAny.from('activity_log').insert({
          project_id: project.id,
          user_id: call.user_id || user.id,
          entity_type: 'person',
          entity_id: call.person_id,
          action: 'logged',
          activity_type: 'call',
          person_id: call.person_id,
          organization_id: call.organization_id,
          direction: call.direction,
          duration_minutes: durationMinutes,
          outcome,
          subject: `${directionLabel} call to ${call.to_number}`,
          notes: input.disposition_notes,
          metadata: {
            call_id: call.id,
            recording_url: call.recording_url,
            talk_time_seconds: call.talk_time_seconds,
            status: call.status,
            disposition: input.disposition,
          },
        });
        if (insertErr) {
          console.error('[Disposition] Error creating activity:', insertErr);
        } else {
          console.log('[Disposition] Activity created successfully');
        }
      }
    } else {
      console.log('[Disposition] Skipping activity creation - no person_id on call');
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

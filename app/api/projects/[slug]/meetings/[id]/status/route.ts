import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateMeetingStatusSchema } from '@/lib/validators/meeting';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

const MEETING_SELECT = `
  *,
  person:people(id, first_name, last_name, email),
  organization:organizations(id, name),
  opportunity:opportunities(id, name),
  attendees:meeting_attendees(id, person_id, user_id, attendance_status, person:people(id, first_name, last_name, email), user:users(id, full_name, email, avatar_url)),
  created_by_user:users!meetings_created_by_fkey(id, full_name, email, avatar_url),
  assigned_to_user:users!meetings_assigned_to_fkey(id, full_name, email, avatar_url)
`;

// Map meeting outcome to activity outcome
function mapOutcomeToActivityOutcome(
  meetingOutcome: string | null | undefined
): string | null {
  if (!meetingOutcome) return null;
  const mapping: Record<string, string> = {
    positive: 'quality_conversation',
    deal_advanced: 'meeting_booked',
    follow_up_needed: 'follow_up_scheduled',
    negative: 'not_interested',
  };
  return mapping[meetingOutcome] ?? null;
}

// PATCH /api/projects/[slug]/meetings/[id]/status - Update meeting status
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
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

    const body = await request.json();
    const validationResult = updateMeetingStatusSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Fetch existing meeting
    const { data: existingMeeting, error: fetchError } = await supabaseAny
      .from('meetings')
      .select('*')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (fetchError || !existingMeeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const { status, outcome, outcome_notes, next_steps, new_scheduled_at, cancellation_reason } =
      validationResult.data;

    // Build update payload
    const updateData: Record<string, unknown> = {
      status,
      status_changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Handle attended status
    if (status === 'attended') {
      if (outcome !== undefined) updateData.outcome = outcome;
      if (outcome_notes !== undefined) updateData.outcome_notes = outcome_notes;
      if (next_steps !== undefined) updateData.next_steps = next_steps;
    }

    // Handle rescheduled status
    if (status === 'rescheduled') {
      updateData.rescheduled_from = existingMeeting.scheduled_at;
      updateData.reschedule_count = (existingMeeting.reschedule_count ?? 0) + 1;
      if (new_scheduled_at) {
        updateData.scheduled_at = new_scheduled_at;
      }
    }

    // Handle cancelled status
    if (status === 'cancelled') {
      if (cancellation_reason !== undefined) updateData.cancellation_reason = cancellation_reason;
    }

    const { data: updatedMeeting, error: updateError } = await supabaseAny
      .from('meetings')
      .update(updateData)
      .eq('id', id)
      .eq('project_id', project.id)
      .select()
      .single();

    if (updateError || !updatedMeeting) {
      console.error('Error updating meeting status:', updateError);
      return NextResponse.json({ error: 'Failed to update meeting status' }, { status: 500 });
    }

    // Auto-log to activity_log
    const activityOutcome =
      status === 'attended' ? mapOutcomeToActivityOutcome(outcome) : null;

    const { error: activityError } = await supabaseAny
      .from('activity_log')
      .insert({
        project_id: project.id,
        user_id: user.id,
        entity_type: 'meeting',
        entity_id: id,
        action: 'status_changed',
        activity_type: 'meeting',
        person_id: existingMeeting.person_id ?? null,
        organization_id: existingMeeting.organization_id ?? null,
        opportunity_id: existingMeeting.opportunity_id ?? null,
        subject: `Meeting ${status}: ${existingMeeting.title}`,
        outcome: activityOutcome,
        metadata: {
          meeting_id: id,
          meeting_type: existingMeeting.meeting_type,
          status,
          duration_minutes: existingMeeting.duration_minutes,
        },
      });

    if (activityError) {
      console.error('Error logging meeting status activity:', activityError);
    }

    // Fetch the updated meeting with all relations
    const { data: fullMeeting, error: fullFetchError } = await supabaseAny
      .from('meetings')
      .select(MEETING_SELECT)
      .eq('id', id)
      .single();

    if (fullFetchError) {
      console.error('Error fetching updated meeting:', fullFetchError);
      return NextResponse.json(updatedMeeting);
    }

    return NextResponse.json(fullMeeting);
  } catch (error) {
    console.error('Error in PATCH /api/projects/[slug]/meetings/[id]/status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

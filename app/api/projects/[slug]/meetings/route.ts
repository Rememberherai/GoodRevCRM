import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createMeetingSchema, meetingQuerySchema } from '@/lib/validators/meeting';

interface RouteContext {
  params: Promise<{ slug: string }>;
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

// GET /api/projects/[slug]/meetings - List meetings
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
    const queryResult = meetingQuerySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      meeting_type: searchParams.get('meeting_type') ?? undefined,
      person_id: searchParams.get('person_id') ?? undefined,
      organization_id: searchParams.get('organization_id') ?? undefined,
      opportunity_id: searchParams.get('opportunity_id') ?? undefined,
      rfp_id: searchParams.get('rfp_id') ?? undefined,
      assigned_to: searchParams.get('assigned_to') ?? undefined,
      scheduled_after: searchParams.get('scheduled_after') ?? undefined,
      scheduled_before: searchParams.get('scheduled_before') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const {
      status, meeting_type, person_id, organization_id, opportunity_id,
      rfp_id, assigned_to, scheduled_after, scheduled_before, limit, offset,
    } = queryResult.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    let query = supabaseAny
      .from('meetings')
      .select(MEETING_SELECT)
      .eq('project_id', project.id);

    if (status) query = query.eq('status', status);
    if (meeting_type) query = query.eq('meeting_type', meeting_type);
    if (person_id) query = query.eq('person_id', person_id);
    if (organization_id) query = query.eq('organization_id', organization_id);
    if (opportunity_id) query = query.eq('opportunity_id', opportunity_id);
    if (rfp_id) query = query.eq('rfp_id', rfp_id);
    if (assigned_to) query = query.eq('assigned_to', assigned_to);
    if (scheduled_after) query = query.gte('scheduled_at', scheduled_after);
    if (scheduled_before) query = query.lte('scheduled_at', scheduled_before);

    const { data: meetings, error } = await query
      .order('scheduled_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching meetings:', error);
      return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 });
    }

    return NextResponse.json({
      meetings: meetings ?? [],
      pagination: { limit, offset },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/meetings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/meetings - Create meeting
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

    const body = await request.json();
    const validationResult = createMeetingSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { attendee_person_ids, attendee_user_ids, ...meetingData } = validationResult.data;

    // Validate cross-project entity references (29.1)
    const validationErrors: string[] = [];
    if (meetingData.person_id) {
      const { data: person } = await supabaseAny.from('people').select('id').eq('id', meetingData.person_id).eq('project_id', project.id).is('deleted_at', null).single();
      if (!person) validationErrors.push('person_id does not belong to this project');
    }
    if (meetingData.organization_id) {
      const { data: org } = await supabaseAny.from('organizations').select('id').eq('id', meetingData.organization_id).eq('project_id', project.id).is('deleted_at', null).single();
      if (!org) validationErrors.push('organization_id does not belong to this project');
    }
    if (meetingData.opportunity_id) {
      const { data: opp } = await supabaseAny.from('opportunities').select('id').eq('id', meetingData.opportunity_id).eq('project_id', project.id).is('deleted_at', null).single();
      if (!opp) validationErrors.push('opportunity_id does not belong to this project');
    }
    if (meetingData.rfp_id) {
      const { data: rfp } = await supabaseAny.from('rfps').select('id').eq('id', meetingData.rfp_id).eq('project_id', project.id).is('deleted_at', null).single();
      if (!rfp) validationErrors.push('rfp_id does not belong to this project');
    }
    if (meetingData.assigned_to) {
      const { data: member } = await supabaseAny.from('project_memberships').select('user_id').eq('user_id', meetingData.assigned_to).eq('project_id', project.id).single();
      if (!member) validationErrors.push('assigned_to user is not a member of this project');
    }

    // Validate attendee references (29.2)
    if (attendee_person_ids && attendee_person_ids.length > 0) {
      const { data: validPeople } = await supabaseAny.from('people').select('id').eq('project_id', project.id).in('id', attendee_person_ids);
      const validPersonIds = new Set((validPeople ?? []).map((p: { id: string }) => p.id));
      const invalidPersonIds = attendee_person_ids.filter((id: string) => !validPersonIds.has(id));
      if (invalidPersonIds.length > 0) validationErrors.push(`Some attendee_person_ids do not belong to this project: ${invalidPersonIds.join(', ')}`);
    }
    if (attendee_user_ids && attendee_user_ids.length > 0) {
      const { data: validMembers } = await supabaseAny.from('project_memberships').select('user_id').eq('project_id', project.id).in('user_id', attendee_user_ids);
      const validUserIds = new Set((validMembers ?? []).map((m: { user_id: string }) => m.user_id));
      const invalidUserIds = attendee_user_ids.filter((id: string) => !validUserIds.has(id));
      if (invalidUserIds.length > 0) validationErrors.push(`Some attendee_user_ids are not members of this project: ${invalidUserIds.join(', ')}`);
    }

    if (validationErrors.length > 0) {
      return NextResponse.json({ error: 'Validation failed', details: validationErrors }, { status: 400 });
    }

    const { data: meeting, error } = await supabaseAny
      .from('meetings')
      .insert({
        project_id: project.id,
        created_by: user.id,
        ...meetingData,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating meeting:', error);
      return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 });
    }

    // Create attendee records
    const attendeeRows = [
      ...(attendee_person_ids ?? []).map((pid: string) => ({
        meeting_id: meeting.id,
        person_id: pid,
        attendance_status: 'pending',
      })),
      ...(attendee_user_ids ?? []).map((uid: string) => ({
        meeting_id: meeting.id,
        user_id: uid,
        attendance_status: 'pending',
      })),
    ];

    const warnings: string[] = [];
    if (attendeeRows.length > 0) {
      const { error: attendeeError } = await supabaseAny
        .from('meeting_attendees')
        .insert(attendeeRows);

      if (attendeeError) {
        console.error('Error creating meeting attendees:', attendeeError);
        warnings.push('Some attendees could not be added');
      }
    }

    // Log to activity_log
    const { error: activityError } = await supabaseAny
      .from('activity_log')
      .insert({
        project_id: project.id,
        user_id: user.id,
        entity_type: 'meeting',
        entity_id: meeting.id,
        action: 'created',
        activity_type: 'meeting',
        person_id: meetingData.person_id ?? null,
        organization_id: meetingData.organization_id ?? null,
        opportunity_id: meetingData.opportunity_id ?? null,
        subject: `Meeting scheduled: ${meetingData.title}`,
        outcome: 'meeting_booked',
        metadata: {
          meeting_id: meeting.id,
          meeting_type: meetingData.meeting_type,
          scheduled_at: meetingData.scheduled_at,
          duration_minutes: meetingData.duration_minutes,
        },
      });

    if (activityError) {
      console.error('Error logging meeting creation activity:', activityError);
    }

    // Fetch the meeting back with all relations
    const { data: fullMeeting, error: fetchError } = await supabaseAny
      .from('meetings')
      .select(MEETING_SELECT)
      .eq('id', meeting.id)
      .single();

    if (fetchError) {
      console.error('Error fetching created meeting:', fetchError);
      return NextResponse.json({ meeting, warnings: warnings.length > 0 ? warnings : undefined }, { status: 201 });
    }

    return NextResponse.json({ ...fullMeeting, warnings: warnings.length > 0 ? warnings : undefined }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/meetings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

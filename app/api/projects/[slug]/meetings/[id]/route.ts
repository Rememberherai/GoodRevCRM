import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateMeetingSchema } from '@/lib/validators/meeting';

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

// GET /api/projects/[slug]/meetings/[id] - Get single meeting
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

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
    const supabaseAny = supabase as any;

    const { data: meeting, error } = await supabaseAny
      .from('meetings')
      .select(MEETING_SELECT)
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (error || !meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    return NextResponse.json(meeting);
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/meetings/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/meetings/[id] - Update meeting
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
    const validationResult = updateMeetingSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { attendee_person_ids, attendee_user_ids, ...meetingData } = validationResult.data;

    const updateData: Record<string, unknown> = {
      ...meetingData,
      updated_at: new Date().toISOString(),
    };

    const { data: meeting, error } = await supabaseAny
      .from('meetings')
      .update(updateData)
      .eq('id', id)
      .eq('project_id', project.id)
      .select()
      .single();

    if (error || !meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // If attendee lists provided, replace existing attendees
    if (attendee_person_ids !== undefined || attendee_user_ids !== undefined) {
      // Delete existing attendees
      const { error: deleteError } = await supabaseAny
        .from('meeting_attendees')
        .delete()
        .eq('meeting_id', id);

      if (deleteError) {
        console.error('Error deleting existing attendees:', deleteError);
      }

      // Re-insert attendees
      const attendeeRows = [
        ...(attendee_person_ids ?? []).map((pid: string) => ({
          meeting_id: id,
          person_id: pid,
          attendance_status: 'pending',
        })),
        ...(attendee_user_ids ?? []).map((uid: string) => ({
          meeting_id: id,
          user_id: uid,
          attendance_status: 'pending',
        })),
      ];

      if (attendeeRows.length > 0) {
        const { error: insertError } = await supabaseAny
          .from('meeting_attendees')
          .insert(attendeeRows);

        if (insertError) {
          console.error('Error inserting meeting attendees:', insertError);
        }
      }
    }

    // Fetch the updated meeting with all relations
    const { data: fullMeeting, error: fetchError } = await supabaseAny
      .from('meetings')
      .select(MEETING_SELECT)
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching updated meeting:', fetchError);
      return NextResponse.json(meeting);
    }

    return NextResponse.json(fullMeeting);
  } catch (error) {
    console.error('Error in PATCH /api/projects/[slug]/meetings/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/meetings/[id] - Delete meeting
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

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
    const supabaseAny = supabase as any;

    // Check if user is the creator or has admin/owner role
    const { data: meeting } = await supabaseAny
      .from('meetings')
      .select('created_by')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const isCreator = meeting.created_by === user.id;

    if (!isCreator) {
      // Check admin access
      const { data: membership } = await supabaseAny
        .from('project_members')
        .select('role')
        .eq('project_id', project.id)
        .eq('user_id', user.id)
        .single();

      if (!membership || !['owner', 'admin'].includes(membership?.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { error } = await supabaseAny
      .from('meetings')
      .delete()
      .eq('id', id)
      .eq('project_id', project.id);

    if (error) {
      console.error('Error deleting meeting:', error);
      return NextResponse.json({ error: 'Failed to delete meeting' }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error in DELETE /api/projects/[slug]/meetings/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

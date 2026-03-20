import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { createTimeEntrySchema, updateTimeEntrySchema } from '@/lib/validators/community/contractors';
import { computeTimeEntryDurationMinutes } from '@/lib/community/jobs';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.project_type !== 'community') return NextResponse.json({ error: 'Not a community project' }, { status: 400 });

    await requireCommunityPermission(supabase, user.id, project.id, 'jobs', 'view');

    const { data: jobCheck } = await supabase
      .from('jobs')
      .select('id')
      .eq('id', id)
      .eq('project_id', project.id)
      .maybeSingle();
    if (!jobCheck) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    const { data: entries, error } = await supabase
      .from('job_time_entries')
      .select('*')
      .eq('job_id', id)
      .order('started_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to load time entries' }, { status: 500 });
    }

    return NextResponse.json({ entries: entries ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/jobs/[id]/time-entries:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.project_type !== 'community') return NextResponse.json({ error: 'Not a community project' }, { status: 400 });

    await requireCommunityPermission(supabase, user.id, project.id, 'jobs', 'update');

    const { data: jobCheck } = await supabase
      .from('jobs')
      .select('id, status')
      .eq('id', id)
      .eq('project_id', project.id)
      .maybeSingle();
    if (!jobCheck) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    const terminalStatuses = ['completed', 'declined', 'pulled'];
    if (terminalStatuses.includes(jobCheck.status)) {
      return NextResponse.json({ error: `Cannot add time entries to a ${jobCheck.status} job` }, { status: 409 });
    }

    const body = await request.json();
    const validation = createTimeEntrySchema.safeParse({
      ...body,
      job_id: id,
      started_at: body.started_at ?? new Date().toISOString(),
    });
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { data: activeEntry } = await supabase
      .from('job_time_entries')
      .select('id')
      .eq('job_id', id)
      .is('ended_at', null)
      .limit(1)
      .maybeSingle();

    if (activeEntry) {
      return NextResponse.json({ error: 'An active time entry is already running for this job' }, { status: 409 });
    }

    const { data: entry, error } = await supabase
      .from('job_time_entries')
      .insert({
        job_id: id,
        started_at: validation.data.started_at,
        ended_at: validation.data.ended_at ?? null,
        is_break: validation.data.is_break,
        duration_minutes: computeTimeEntryDurationMinutes(validation.data.started_at, validation.data.ended_at ?? null),
        notes: typeof body.notes === 'string' ? body.notes.slice(0, 2000) : null,
      })
      .select('*')
      .single();

    if (error || !entry) {
      return NextResponse.json({ error: 'Failed to create time entry' }, { status: 500 });
    }

    await supabase
      .from('jobs')
      .update({ status: entry.is_break ? 'paused' : 'in_progress' })
      .eq('project_id', project.id)
      .eq('id', id);

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/jobs/[id]/time-entries:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.project_type !== 'community') return NextResponse.json({ error: 'Not a community project' }, { status: 400 });

    await requireCommunityPermission(supabase, user.id, project.id, 'jobs', 'update');

    const { data: jobCheck } = await supabase
      .from('jobs')
      .select('id, status')
      .eq('id', id)
      .eq('project_id', project.id)
      .maybeSingle();
    if (!jobCheck) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    const body = await request.json() as Record<string, unknown>;
    const validation = updateTimeEntrySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const timeEntryId = typeof body.time_entry_id === 'string' ? body.time_entry_id : null;

    let entryQuery = supabase
      .from('job_time_entries')
      .select('*')
      .eq('job_id', id);

    entryQuery = timeEntryId
      ? entryQuery.eq('id', timeEntryId)
      : entryQuery.is('ended_at', null).order('started_at', { ascending: false }).limit(1);

    const { data: entry, error: entryError } = await entryQuery.maybeSingle();
    if (entryError || !entry) {
      return NextResponse.json({ error: 'Time entry not found' }, { status: 404 });
    }

    const startedAt = validation.data.started_at ?? entry.started_at;
    const endedAt = validation.data.ended_at === undefined ? entry.ended_at : validation.data.ended_at;
    const notes = body.notes === undefined
      ? entry.notes
      : (typeof body.notes === 'string' ? body.notes.slice(0, 2000) : (body.notes === null ? null : entry.notes));

    const { data: updatedEntry, error } = await supabase
      .from('job_time_entries')
      .update({
        started_at: startedAt,
        ended_at: endedAt,
        is_break: validation.data.is_break ?? entry.is_break,
        duration_minutes: computeTimeEntryDurationMinutes(startedAt, endedAt ?? null),
        notes,
      })
      .eq('id', entry.id)
      .select('*')
      .single();

    if (error || !updatedEntry) {
      return NextResponse.json({ error: 'Failed to update time entry' }, { status: 500 });
    }

    const terminalStatuses = ['completed', 'declined', 'pulled'];
    const nextStatus = !updatedEntry.ended_at
      ? (updatedEntry.is_break ? 'paused' : 'in_progress')
      : undefined;

    if (nextStatus && !terminalStatuses.includes(jobCheck.status)) {
      await supabase
        .from('jobs')
        .update({ status: nextStatus })
        .eq('project_id', project.id)
        .eq('id', id);
    }

    return NextResponse.json({ entry: updatedEntry });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PATCH /api/projects/[slug]/jobs/[id]/time-entries:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

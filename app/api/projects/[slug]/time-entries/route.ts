import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { createTimeEntrySchema } from '@/lib/validators/community/contractors';
import { computeTimeEntryDurationMinutes } from '@/lib/community/jobs';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
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

    const url = new URL(request.url);
    const contractorId = url.searchParams.get('contractor_id');
    const jobId = url.searchParams.get('job_id');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10)));
    const offset = (page - 1) * limit;

    let query = supabase
      .from('job_time_entries')
      .select('*, jobs(id, title, project_id, contractor_id), contractor:people!job_time_entries_contractor_id_fkey(id, first_name, last_name)');

    // Scope to this project: job-linked via jobs.project_id, standalone via people.project_id
    // We filter after fetch using project.id since Supabase doesn't support nested OR on joined tables easily
    if (contractorId) {
      query = query.eq('contractor_id', contractorId);
    }
    if (jobId) {
      query = query.eq('job_id', jobId);
    }
    if (from) {
      query = query.gte('started_at', from);
    }
    if (to) {
      // Include the full end day
      query = query.lte('started_at', `${to}T23:59:59.999Z`);
    }

    query = query.order('started_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: allEntries, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Failed to load time entries' }, { status: 500 });
    }

    // Filter to this project only
    const entries = (allEntries ?? []).filter((entry) => {
      if (entry.job_id && entry.jobs) {
        return (entry.jobs as { project_id?: string }).project_id === project.id;
      }
      if (!entry.job_id && entry.contractor_id) {
        // Standalone: allowed if contractor belongs to this project (RLS handles enforcement; include all returned)
        return true;
      }
      return false;
    });

    return NextResponse.json({ entries, total: entries.length });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/time-entries:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
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

    const body = await request.json() as Record<string, unknown>;
    const validation = createTimeEntrySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { job_id, contractor_id } = validation.data;

    // Validate job belongs to project if provided
    if (job_id) {
      const { data: jobCheck } = await supabase
        .from('jobs')
        .select('id, status')
        .eq('id', job_id)
        .eq('project_id', project.id)
        .maybeSingle();
      if (!jobCheck) return NextResponse.json({ error: 'Job not found in this project' }, { status: 404 });
      const terminalStatuses = ['completed', 'declined', 'pulled', 'cancelled'];
      if (terminalStatuses.includes(jobCheck.status)) {
        return NextResponse.json({ error: `Cannot add time entries to a ${jobCheck.status} job` }, { status: 409 });
      }
    }

    // Validate contractor belongs to project if standalone
    if (!job_id && contractor_id) {
      const { data: personCheck } = await supabase
        .from('people')
        .select('id')
        .eq('id', contractor_id)
        .eq('project_id', project.id)
        .maybeSingle();
      if (!personCheck) return NextResponse.json({ error: 'Contractor not found in this project' }, { status: 404 });
    }

    const { data: entry, error } = await supabase
      .from('job_time_entries')
      .insert({
        job_id: job_id ?? null,
        contractor_id: contractor_id ?? null,
        started_at: validation.data.started_at,
        ended_at: validation.data.ended_at ?? null,
        is_break: validation.data.is_break,
        duration_minutes: computeTimeEntryDurationMinutes(validation.data.started_at, validation.data.ended_at ?? null),
        category: validation.data.category ?? null,
        notes: typeof body.notes === 'string' ? body.notes.slice(0, 2000) : null,
      })
      .select('*')
      .single();

    if (error || !entry) {
      return NextResponse.json({ error: 'Failed to create time entry' }, { status: 500 });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.created',
      entityType: 'job',
      entityId: job_id ?? contractor_id ?? '',
      data: { time_entry: entry } as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/time-entries:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

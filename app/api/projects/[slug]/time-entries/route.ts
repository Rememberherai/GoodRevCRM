import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { createTimeEntrySchema } from '@/lib/validators/community/contractors';
import { computeTimeEntryDurationMinutes } from '@/lib/community/jobs';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { Json } from '@/types/database';

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
    const personId = url.searchParams.get('person_id');
    const jobId = url.searchParams.get('job_id');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10)));
    const offset = (page - 1) * limit;

    let query = supabase
      .from('job_time_entries')
      .select('*, jobs(id, title, project_id, contractor_id), contractor:people!job_time_entries_contractor_id_fkey(id, first_name, last_name, project_id), person:people!job_time_entries_person_id_fkey(id, first_name, last_name, project_id)');

    // person_id and contractor_id filters are treated equivalently (dual-write transition)
    const workerFilter = personId ?? contractorId;
    if (workerFilter) {
      query = query.or(`contractor_id.eq.${workerFilter},person_id.eq.${workerFilter}`);
    }
    if (jobId) {
      query = query.eq('job_id', jobId);
    }
    if (from) {
      query = query.gte('started_at', from);
    }
    if (to) {
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
      if (!entry.job_id) {
        const contractorProjectId = entry.contractor
          ? (entry.contractor as { project_id?: string }).project_id
          : null;
        const personProjectId = entry.person
          ? (entry.person as { project_id?: string }).project_id
          : null;
        return contractorProjectId === project.id || personProjectId === project.id;
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

    const { job_id } = validation.data;
    // Dual-write both columns during transition: person_id takes priority, fall back to contractor_id
    const workerId = validation.data.person_id ?? validation.data.contractor_id ?? null;

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

    // Validate worker belongs to project if standalone
    if (!job_id && workerId) {
      const { data: personCheck } = await supabase
        .from('people')
        .select('id')
        .eq('id', workerId)
        .eq('project_id', project.id)
        .maybeSingle();
      if (!personCheck) return NextResponse.json({ error: 'Worker not found in this project' }, { status: 404 });
    }

    const { data: entry, error } = await supabase
      .from('job_time_entries')
      .insert({
        job_id: job_id ?? null,
        contractor_id: workerId, // dual-write
        person_id: workerId,     // dual-write
        started_at: validation.data.started_at,
        ended_at: validation.data.ended_at ?? null,
        is_break: validation.data.is_break,
        duration_minutes: computeTimeEntryDurationMinutes(validation.data.started_at, validation.data.ended_at ?? null),
        category: validation.data.category ?? null,
        notes: typeof body.notes === 'string' ? body.notes.slice(0, 2000) : null,
        entry_source: 'admin',
      })
      .select('*')
      .single();

    if (error || !entry) {
      return NextResponse.json({ error: 'Failed to create time entry' }, { status: 500 });
    }

    // Write audit row using admin client (time_entry_audit has SELECT-only RLS)
    try {
      const adminClient = createAdminClient();
      await adminClient.from('time_entry_audit').insert({
        time_entry_id: entry.id,
        project_id: project.id,
        person_id: workerId,
        action: 'insert',
        changed_by: user.id,
        changed_by_role: 'admin',
        entry_source: 'admin',
        new_data: entry as unknown as Json,
      });
    } catch (auditErr) {
      console.error('Failed to write time_entry_audit row:', auditErr);
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.created',
      entityType: 'job',
      entityId: job_id ?? workerId ?? '',
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

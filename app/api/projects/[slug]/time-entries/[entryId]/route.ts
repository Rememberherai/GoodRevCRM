import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { updateTimeEntrySchema } from '@/lib/validators/community/contractors';
import { computeTimeEntryDurationMinutes } from '@/lib/community/jobs';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ slug: string; entryId: string }>;
}

async function resolveEntry(supabase: Awaited<ReturnType<typeof createClient>>, entryId: string, projectId: string) {
  const { data: entry } = await supabase
    .from('job_time_entries')
    .select('*, jobs(id, project_id), contractor:people!job_time_entries_contractor_id_fkey(id, project_id)')
    .eq('id', entryId)
    .maybeSingle();

  if (!entry) return null;

  // Verify entry belongs to this project
  const jobProject = entry.job_id && entry.jobs
    ? (entry.jobs as { project_id?: string }).project_id
    : null;
  const contractorProject = !entry.job_id && entry.contractor
    ? (entry.contractor as { project_id?: string }).project_id
    : null;

  if (jobProject !== projectId && contractorProject !== projectId) return null;
  return entry;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, entryId } = await context.params;
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

    const entry = await resolveEntry(supabase, entryId, project.id);
    if (!entry) return NextResponse.json({ error: 'Time entry not found' }, { status: 404 });

    const body = await request.json() as Record<string, unknown>;
    const validation = updateTimeEntrySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const startedAt = validation.data.started_at ?? entry.started_at;
    const endedAt = validation.data.ended_at === undefined ? entry.ended_at : validation.data.ended_at;
    if (endedAt && Date.parse(endedAt) <= Date.parse(startedAt)) {
      return NextResponse.json({ error: 'ended_at must be after started_at' }, { status: 400 });
    }
    const notes = body.notes === undefined
      ? entry.notes
      : (typeof body.notes === 'string' ? body.notes.slice(0, 2000) : (body.notes === null ? null : entry.notes));
    const category = validation.data.category === undefined
      ? entry.category
      : (validation.data.category ?? null);

    const { data: updatedEntry, error } = await supabase
      .from('job_time_entries')
      .update({
        started_at: startedAt,
        ended_at: endedAt,
        is_break: validation.data.is_break ?? entry.is_break,
        duration_minutes: computeTimeEntryDurationMinutes(startedAt, endedAt ?? null),
        category,
        notes,
      })
      .eq('id', entryId)
      .select('*')
      .single();

    if (error || !updatedEntry) {
      return NextResponse.json({ error: 'Failed to update time entry' }, { status: 500 });
    }

    const refId = entry.job_id ?? entry.contractor_id ?? '';
    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.updated',
      entityType: 'job',
      entityId: refId,
      data: { time_entry: updatedEntry } as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ entry: updatedEntry });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PATCH /api/projects/[slug]/time-entries/[entryId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, entryId } = await context.params;
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

    await requireCommunityPermission(supabase, user.id, project.id, 'jobs', 'delete');

    const entry = await resolveEntry(supabase, entryId, project.id);
    if (!entry) return NextResponse.json({ error: 'Time entry not found' }, { status: 404 });

    const { error } = await supabase
      .from('job_time_entries')
      .delete()
      .eq('id', entryId);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete time entry' }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/projects/[slug]/time-entries/[entryId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { updateTimeEntrySchema } from '@/lib/validators/community/contractors';
import { computeTimeEntryDurationMinutes } from '@/lib/community/jobs';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { Json } from '@/types/database';

interface RouteContext {
  params: Promise<{ slug: string; entryId: string }>;
}

async function resolveEntry(supabase: Awaited<ReturnType<typeof createClient>>, entryId: string, projectId: string) {
  const { data: entry } = await supabase
    .from('job_time_entries')
    .select('*, jobs(id, project_id), contractor:people!job_time_entries_contractor_id_fkey(id, project_id), person:people!job_time_entries_person_id_fkey(id, project_id)')
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
  const personProject = !entry.job_id && entry.person
    ? (entry.person as { project_id?: string }).project_id
    : null;

  if (jobProject !== projectId && contractorProject !== projectId && personProject !== projectId) return null;
  return entry;
}

async function writeAudit(params: {
  timeEntryId: string;
  projectId: string;
  personId: string | null;
  action: 'insert' | 'update' | 'delete';
  changedBy: string;
  changedByRole: string;
  entrySource: string | null;
  oldData?: Json | null;
  newData?: Json | null;
}) {
  try {
    const adminClient = createAdminClient();
    await adminClient.from('time_entry_audit').insert({
      time_entry_id: params.timeEntryId,
      project_id: params.projectId,
      person_id: params.personId,
      action: params.action,
      changed_by: params.changedBy,
      changed_by_role: params.changedByRole,
      entry_source: params.entrySource,
      old_data: params.oldData ?? null,
      new_data: params.newData ?? null,
    });
  } catch (err) {
    console.error('Failed to write time_entry_audit row:', err);
  }
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

    const workerId = (entry.person_id ?? entry.contractor_id ?? null);
    await writeAudit({
      timeEntryId: entryId,
      projectId: project.id,
      personId: workerId,
      action: 'update',
      changedBy: user.id,
      changedByRole: 'admin',
      entrySource: entry.entry_source ?? null,
      oldData: entry as unknown as Json,
      newData: updatedEntry as unknown as Json,
    });

    const refId = entry.job_id ?? entry.contractor_id ?? entry.person_id ?? '';
    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.updated',
      entityType: 'job',
      entityId: refId as string,
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

    // Write audit row BEFORE deleting
    const workerId = (entry.person_id ?? entry.contractor_id ?? null);
    await writeAudit({
      timeEntryId: entryId,
      projectId: project.id,
      personId: workerId,
      action: 'delete',
      changedBy: user.id,
      changedByRole: 'admin',
      entrySource: entry.entry_source ?? null,
      oldData: entry as unknown as Json,
    });

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

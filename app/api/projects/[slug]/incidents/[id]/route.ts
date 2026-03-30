import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser, getProjectBySlug } from '@/lib/community/server';
import { requireCommunityPermission, type CommunityAction } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { updateIncidentSchema } from '@/lib/validators/incident';
import { ensureProjectEntity, ensureProjectUserMembership, normalizeIncidentVisibility } from '@/lib/community/ops';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

async function resolveContext(slug: string, action: CommunityAction) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const project = await getProjectBySlug(supabase, slug);
  if (!project) return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };

  const role = await requireCommunityPermission(supabase, user.id, project.id, 'incidents', action);
  return { supabase, user, project, role };
}

async function getIncidentRecord(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string, incidentId: string) {
  const supabaseAny = supabase as any;
  const { data, error } = await supabaseAny
    .from('incidents')
    .select(`
      *,
      household:households(id, name),
      assignee:users!incidents_assigned_to_fkey(id, full_name, email)
    `)
    .eq('project_id', projectId)
    .eq('id', incidentId)
    .single();

  if (error || !data) return null;
  return data;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const resolved = await resolveContext(slug, 'view');
    if ('error' in resolved) return resolved.error;

    const supabaseAny = resolved.supabase as any;
    const incident = await getIncidentRecord(resolved.supabase, resolved.project.id, id);
    if (!incident) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    const [peopleResult, notesResult, tasksResult] = await Promise.all([
      supabaseAny
        .from('incident_people')
        .select('*, person:people(id, first_name, last_name, email)')
        .eq('incident_id', id)
        .order('created_at', { ascending: true }),
      supabaseAny
        .from('notes')
        .select('*, author:users!notes_created_by_fkey(id, full_name, email, avatar_url)')
        .eq('project_id', resolved.project.id)
        .eq('incident_id', id)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false }),
      supabaseAny
        .from('tasks')
        .select('*, assigned_user:users!tasks_assigned_to_fkey(id, full_name, email)')
        .eq('project_id', resolved.project.id)
        .eq('incident_id', id)
        .order('due_date', { ascending: true, nullsFirst: false }),
    ]);

    return NextResponse.json({
      incident,
      people: peopleResult.data ?? [],
      notes: notesResult.data ?? [],
      tasks: tasksResult.data ?? [],
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/incidents/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const resolved = await resolveContext(slug, 'update');
    if ('error' in resolved) return resolved.error;

    const existing = await getIncidentRecord(resolved.supabase, resolved.project.id, id);
    if (!existing) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    const body = await request.json();
    const validationResult = updateIncidentSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Validation failed', details: validationResult.error.flatten() }, { status: 400 });
    }

    const updates = { ...validationResult.data } as Record<string, unknown>;
    const supabase = resolved.supabase as any;

    if (updates.assigned_to) {
      const isMember = await ensureProjectUserMembership(supabase, String(updates.assigned_to), resolved.project.id);
      if (!isMember) {
        return NextResponse.json({ error: 'assigned_to must be a member of this project' }, { status: 400 });
      }
    }

    if (updates.household_id) {
      const exists = await ensureProjectEntity(supabase, 'households', String(updates.household_id), resolved.project.id);
      if (!exists) return NextResponse.json({ error: 'household_id not found in this project' }, { status: 400 });
    }
    if (updates.event_id) {
      const exists = await ensureProjectEntity(supabase, 'events', String(updates.event_id), resolved.project.id, { nullableDeletedAt: false });
      if (!exists) return NextResponse.json({ error: 'event_id not found in this project' }, { status: 400 });
    }
    if (updates.asset_id) {
      const exists = await ensureProjectEntity(supabase, 'community_assets', String(updates.asset_id), resolved.project.id, { nullableDeletedAt: false });
      if (!exists) return NextResponse.json({ error: 'asset_id not found in this project' }, { status: 400 });
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'visibility')) {
      updates.visibility = normalizeIncidentVisibility(updates.visibility, resolved.role, 'update');
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('incidents')
      .update(updates)
      .eq('project_id', resolved.project.id)
      .eq('id', id)
      .select(`
        *,
        household:households(id, name),
        assignee:users!incidents_assigned_to_fkey(id, full_name, email)
      `)
      .single();

    if (error || !data) {
      console.error('Error updating incident:', error);
      return NextResponse.json({ error: 'Failed to update incident' }, { status: 500 });
    }

    if (updates.severity && updates.severity !== existing.severity) {
      emitAutomationEvent({
        projectId: resolved.project.id,
        triggerType: 'incident.severity_changed' as never,
        entityType: 'incident' as never,
        entityId: id,
        data: data as Record<string, unknown>,
        previousData: { severity: existing.severity },
      });
    }

    if (updates.status === 'resolved' && existing.status !== 'resolved') {
      emitAutomationEvent({
        projectId: resolved.project.id,
        triggerType: 'incident.resolved' as never,
        entityType: 'incident' as never,
        entityId: id,
        data: data as Record<string, unknown>,
      });
    }

    return NextResponse.json({ incident: data });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PATCH /api/projects/[slug]/incidents/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const resolved = await resolveContext(slug, 'delete');
    if ('error' in resolved) return resolved.error;

    const existing = await getIncidentRecord(resolved.supabase, resolved.project.id, id);
    if (!existing) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    const { error } = await (resolved.supabase as any)
      .from('incidents')
      .delete()
      .eq('project_id', resolved.project.id)
      .eq('id', id);

    if (error) {
      console.error('Error deleting incident:', error);
      return NextResponse.json({ error: 'Failed to delete incident' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/projects/[slug]/incidents/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

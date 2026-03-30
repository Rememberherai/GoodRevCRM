import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser, getProjectBySlug } from '@/lib/community/server';
import { requireCommunityPermission, type CommunityAction } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { updateCaseSchema } from '@/lib/validators/case';
import { createHouseholdCaseEvent, ensureProjectUserMembership } from '@/lib/community/ops';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

async function resolveContext(slug: string, action: CommunityAction) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const project = await getProjectBySlug(supabase, slug);
  if (!project) {
    return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };
  }

  await requireCommunityPermission(supabase, user.id, project.id, 'cases', action);
  return { supabase, user, project };
}

async function getCaseRecord(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string, caseId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any;
  const { data, error } = await supabaseAny
    .from('household_cases')
    .select(`
      *,
      household:households(id, name),
      assignee:users!household_cases_assigned_to_fkey(id, full_name, email)
    `)
    .eq('project_id', projectId)
    .eq('id', caseId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const resolved = await resolveContext(slug, 'view');
    if ('error' in resolved) return resolved.error;

    const record = await getCaseRecord(resolved.supabase, resolved.project.id, id);
    if (!record) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = resolved.supabase as any;
    const [goalsResult, notesResult, tasksResult] = await Promise.all([
      supabaseAny
        .from('household_case_goals')
        .select('*')
        .eq('case_id', id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabaseAny
        .from('notes')
        .select('*, author:users!notes_created_by_fkey(id, full_name, email, avatar_url)')
        .eq('project_id', resolved.project.id)
        .eq('case_id', id)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false }),
      supabaseAny
        .from('tasks')
        .select('*, assigned_user:users!tasks_assigned_to_fkey(id, full_name, email)')
        .eq('project_id', resolved.project.id)
        .eq('case_id', id)
        .order('due_date', { ascending: true, nullsFirst: false }),
    ]);

    return NextResponse.json({
      case: record,
      goals: goalsResult.data ?? [],
      notes: notesResult.data ?? [],
      tasks: tasksResult.data ?? [],
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/households/cases/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const resolved = await resolveContext(slug, 'update');
    if ('error' in resolved) return resolved.error;

    const existing = await getCaseRecord(resolved.supabase, resolved.project.id, id);
    if (!existing) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const body = await request.json();
    const validationResult = updateCaseSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Validation failed', details: validationResult.error.flatten() }, { status: 400 });
    }

    const updates = { ...validationResult.data } as Record<string, unknown>;

    if (updates.assigned_to) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isMember = await ensureProjectUserMembership(resolved.supabase as any, String(updates.assigned_to), resolved.project.id);
      if (!isMember) {
        return NextResponse.json({ error: 'assigned_to must be a member of this project' }, { status: 400 });
      }
    }

    if (updates.status === 'closed') {
      updates.closed_at = new Date().toISOString();
    } else if (updates.status && updates.status !== 'closed') {
      updates.closed_at = null;
      if (existing.status === 'closed') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await createHouseholdCaseEvent(resolved.supabase as any, {
          caseId: id,
          householdId: existing.household_id,
          projectId: resolved.project.id,
          eventType: 'reopened',
          summary: 'Case reopened',
          createdBy: resolved.user.id,
        });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = resolved.supabase as any;
    const { data, error } = await supabaseAny
      .from('household_cases')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('project_id', resolved.project.id)
      .eq('id', id)
      .select(`
        *,
        household:households(id, name),
        assignee:users!household_cases_assigned_to_fkey(id, full_name, email)
      `)
      .single();

    if (error || !data) {
      console.error('Error updating case:', error);
      return NextResponse.json({ error: 'Failed to update case' }, { status: 500 });
    }

    if (updates.status && updates.status !== existing.status) {
      await createHouseholdCaseEvent(supabaseAny, {
        caseId: data.id,
        householdId: data.household_id,
        projectId: resolved.project.id,
        eventType: updates.status === 'closed' ? 'closed' : 'status_changed',
        summary: updates.status === 'closed' ? 'Case closed' : `Case status changed to ${updates.status}`,
        createdBy: resolved.user.id,
        metadata: { from: existing.status, to: updates.status },
      });

      emitAutomationEvent({
        projectId: resolved.project.id,
        triggerType: 'case.status_changed' as never,
        entityType: 'case' as never,
        entityId: data.id,
        data: data as Record<string, unknown>,
        previousData: { status: existing.status },
      });
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'assigned_to') && updates.assigned_to !== existing.assigned_to) {
      await createHouseholdCaseEvent(supabaseAny, {
        caseId: data.id,
        householdId: data.household_id,
        projectId: resolved.project.id,
        eventType: 'assigned',
        summary: data.assignee?.full_name ? `Assigned to ${data.assignee.full_name}` : 'Case assignment updated',
        createdBy: resolved.user.id,
        metadata: { from: existing.assigned_to, to: updates.assigned_to },
      });

      emitAutomationEvent({
        projectId: resolved.project.id,
        triggerType: 'case.assigned' as never,
        entityType: 'case' as never,
        entityId: data.id,
        data: data as Record<string, unknown>,
      });
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'next_follow_up_at') && updates.next_follow_up_at !== existing.next_follow_up_at) {
      await createHouseholdCaseEvent(supabaseAny, {
        caseId: data.id,
        householdId: data.household_id,
        projectId: resolved.project.id,
        eventType: 'follow_up_scheduled',
        summary: data.next_follow_up_at ? 'Follow-up scheduled' : 'Follow-up cleared',
        createdBy: resolved.user.id,
        metadata: { from: existing.next_follow_up_at, to: data.next_follow_up_at },
      });
    }

    if (updates.last_contact_at && updates.last_contact_at !== existing.last_contact_at) {
      await createHouseholdCaseEvent(supabaseAny, {
        caseId: data.id,
        householdId: data.household_id,
        projectId: resolved.project.id,
        eventType: 'contact_logged',
        summary: 'Contact recorded',
        createdBy: resolved.user.id,
      });
    }

    return NextResponse.json({ case: data });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PATCH /api/projects/[slug]/households/cases/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const resolved = await resolveContext(slug, 'delete');
    if ('error' in resolved) return resolved.error;

    const record = await getCaseRecord(resolved.supabase, resolved.project.id, id);
    if (!record) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (resolved.supabase as any)
      .from('household_cases')
      .delete()
      .eq('project_id', resolved.project.id)
      .eq('id', id);

    if (error) {
      console.error('Error deleting case:', error);
      return NextResponse.json({ error: 'Failed to delete case' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/projects/[slug]/households/cases/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

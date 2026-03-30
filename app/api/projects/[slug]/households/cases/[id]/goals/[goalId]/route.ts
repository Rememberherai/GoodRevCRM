import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser, getProjectBySlug } from '@/lib/community/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { updateCaseGoalSchema } from '@/lib/validators/case';
import { createHouseholdCaseEvent, ensureProjectUserMembership } from '@/lib/community/ops';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ slug: string; id: string; goalId: string }>;
}

async function resolveContext(slug: string, action: 'update' | 'delete') {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const project = await getProjectBySlug(supabase, slug);
  if (!project) return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };

  await requireCommunityPermission(supabase, user.id, project.id, 'cases', action);
  return { supabase, user, project };
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id, goalId } = await context.params;
    const resolved = await resolveContext(slug, 'update');
    if ('error' in resolved) return resolved.error;

    const body = await request.json();
    const validationResult = updateCaseGoalSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Validation failed', details: validationResult.error.flatten() }, { status: 400 });
    }

    if (validationResult.data.owner_user_id) {
      const isMember = await ensureProjectUserMembership(resolved.supabase as any, validationResult.data.owner_user_id, resolved.project.id);
      if (!isMember) {
        return NextResponse.json({ error: 'owner_user_id must be a member of this project' }, { status: 400 });
      }
    }

    const supabaseAny = resolved.supabase as any;
    const { data: caseRecord } = await supabaseAny
      .from('household_cases')
      .select('id, household_id')
      .eq('project_id', resolved.project.id)
      .eq('id', id)
      .single();

    if (!caseRecord) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const { data: existing } = await supabaseAny
      .from('household_case_goals')
      .select('*')
      .eq('id', goalId)
      .eq('case_id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    const updateData = {
      ...validationResult.data,
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>;

    if (validationResult.data.status === 'completed' && !validationResult.data.completed_at) {
      updateData.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAny
      .from('household_case_goals')
      .update(updateData)
      .eq('id', goalId)
      .eq('case_id', id)
      .select('*')
      .single();

    if (error || !data) {
      console.error('Error updating case goal:', error);
      return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 });
    }

    if (validationResult.data.status === 'completed' && existing.status !== 'completed') {
      await createHouseholdCaseEvent(supabaseAny, {
        caseId: id,
        householdId: caseRecord.household_id,
        projectId: resolved.project.id,
        eventType: 'goal_completed',
        summary: `Goal completed: ${data.title}`,
        createdBy: resolved.user.id,
        metadata: { goal_id: goalId },
      });

      emitAutomationEvent({
        projectId: resolved.project.id,
        triggerType: 'case.goal_completed' as never,
        entityType: 'case' as never,
        entityId: id,
        data: data as Record<string, unknown>,
      });
    }

    return NextResponse.json({ goal: data });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PATCH /api/projects/[slug]/households/cases/[id]/goals/[goalId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id, goalId } = await context.params;
    const resolved = await resolveContext(slug, 'delete');
    if ('error' in resolved) return resolved.error;

    const supabaseAny = resolved.supabase as any;
    const { data: existing } = await supabaseAny
      .from('household_case_goals')
      .select('id')
      .eq('case_id', id)
      .eq('id', goalId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    const { error } = await supabaseAny
      .from('household_case_goals')
      .delete()
      .eq('case_id', id)
      .eq('id', goalId);

    if (error) {
      console.error('Error deleting case goal:', error);
      return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/projects/[slug]/households/cases/[id]/goals/[goalId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateTaskSchema } from '@/lib/validators/task';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { ensureProjectEntity, ensureProjectUserMembership } from '@/lib/community/ops';
import { canAccessCommunityResource, getProjectMembershipRole } from '@/lib/community/server';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

async function getTaskRecord(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  projectId: string,
  taskId: string
) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*, assigned_user:users!tasks_assigned_to_fkey(id, full_name, email)')
    .eq('id', taskId)
    .eq('project_id', projectId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

// GET /api/projects/[slug]/tasks/[id] - Get task
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

    const membershipRole = await getProjectMembershipRole(supabase, user.id, project.id);
    if (!membershipRole) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const task = await getTaskRecord(supabaseAny, project.id, id);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (task.case_id) {
      const canViewCases = await canAccessCommunityResource(supabase, user.id, project.id, 'cases', 'view');
      if (!canViewCases) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    if (task.incident_id) {
      const canViewIncidents = await canAccessCommunityResource(supabase, user.id, project.id, 'incidents', 'view');
      if (!canViewIncidents) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/tasks/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/tasks/[id] - Update task
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

    const membershipRole = await getProjectMembershipRole(supabase, user.id, project.id);
    if (!membershipRole) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const validationResult = updateTaskSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { data: existingTask } = await supabaseAny
      .from('tasks')
      .select('id, household_id, case_id, incident_id')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Validate assigned_to is a project member
    if (validationResult.data.assigned_to) {
      const isMember = await ensureProjectUserMembership(supabaseAny, validationResult.data.assigned_to, project.id);
      if (!isMember) {
        return NextResponse.json(
          { error: 'assigned_to must be a member of this project' },
          { status: 400 }
        );
      }
    }

    // If grant_id is being changed to a non-null value, verify it belongs to this project
    if (validationResult.data.grant_id !== undefined && validationResult.data.grant_id !== null) {
      const { data: grantData } = await supabaseAny
        .from('grants')
        .select('id')
        .eq('id', validationResult.data.grant_id)
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .single();
      if (!grantData) {
        return NextResponse.json({ error: 'grant_id not found in this project' }, { status: 404 });
      }
    }

    if (validationResult.data.person_id !== undefined && validationResult.data.person_id !== null) {
      const { data: personData } = await supabaseAny
        .from('people')
        .select('id')
        .eq('id', validationResult.data.person_id)
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .single();
      if (!personData) {
        return NextResponse.json({ error: 'person_id not found in this project' }, { status: 400 });
      }
    }

    if (validationResult.data.organization_id !== undefined && validationResult.data.organization_id !== null) {
      const { data: organizationData } = await supabaseAny
        .from('organizations')
        .select('id')
        .eq('id', validationResult.data.organization_id)
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .single();
      if (!organizationData) {
        return NextResponse.json({ error: 'organization_id not found in this project' }, { status: 400 });
      }
    }

    if (validationResult.data.opportunity_id !== undefined && validationResult.data.opportunity_id !== null) {
      const { data: opportunityData } = await supabaseAny
        .from('opportunities')
        .select('id')
        .eq('id', validationResult.data.opportunity_id)
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .single();
      if (!opportunityData) {
        return NextResponse.json({ error: 'opportunity_id not found in this project' }, { status: 400 });
      }
    }

    if (validationResult.data.rfp_id !== undefined && validationResult.data.rfp_id !== null) {
      const { data: rfpData } = await supabaseAny
        .from('rfps')
        .select('id')
        .eq('id', validationResult.data.rfp_id)
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .single();
      if (!rfpData) {
        return NextResponse.json({ error: 'rfp_id not found in this project' }, { status: 400 });
      }
    }

    const effectiveCaseId = validationResult.data.case_id !== undefined
      ? validationResult.data.case_id
      : existingTask.case_id;
    const effectiveIncidentId = validationResult.data.incident_id !== undefined
      ? validationResult.data.incident_id
      : existingTask.incident_id;

    if (effectiveCaseId) {
      const canUpdateCases = await canAccessCommunityResource(supabase, user.id, project.id, 'cases', 'update');
      if (!canUpdateCases) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    if (effectiveIncidentId) {
      const canUpdateIncidents = await canAccessCommunityResource(supabase, user.id, project.id, 'incidents', 'update');
      if (!canUpdateIncidents) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    if (effectiveCaseId && effectiveIncidentId) {
      return NextResponse.json(
        { error: 'A task cannot belong to both a case and an incident' },
        { status: 400 }
      );
    }

    if (validationResult.data.household_id) {
      const exists = await ensureProjectEntity(supabaseAny, 'households', validationResult.data.household_id, project.id);
      if (!exists) {
        return NextResponse.json({ error: 'household_id not found in this project' }, { status: 400 });
      }
    }

    let inferredHouseholdId = validationResult.data.household_id ?? existingTask.household_id ?? null;

    if (effectiveCaseId) {
      const { data: caseRecord } = await supabaseAny
        .from('household_cases')
        .select('id, household_id')
        .eq('project_id', project.id)
        .eq('id', effectiveCaseId)
        .single();
      if (!caseRecord) {
        return NextResponse.json({ error: 'case_id not found in this project' }, { status: 400 });
      }
      if (inferredHouseholdId && caseRecord.household_id && inferredHouseholdId !== caseRecord.household_id) {
        return NextResponse.json(
          { error: 'household_id must match the household linked to case_id' },
          { status: 400 }
        );
      }
      inferredHouseholdId = inferredHouseholdId ?? caseRecord.household_id;
    }

    if (effectiveIncidentId) {
      const { data: incidentRecord } = await supabaseAny
        .from('incidents')
        .select('id, household_id')
        .eq('project_id', project.id)
        .eq('id', effectiveIncidentId)
        .single();
      if (!incidentRecord) {
        return NextResponse.json({ error: 'incident_id not found in this project' }, { status: 400 });
      }
      if (inferredHouseholdId && incidentRecord.household_id && inferredHouseholdId !== incidentRecord.household_id) {
        return NextResponse.json(
          { error: 'household_id must match the household linked to incident_id' },
          { status: 400 }
        );
      }
      inferredHouseholdId = inferredHouseholdId ?? incidentRecord.household_id ?? null;
    }

    const updateData: Record<string, unknown> = {
      ...validationResult.data,
      ...(inferredHouseholdId !== undefined ? { household_id: inferredHouseholdId } : {}),
      updated_at: new Date().toISOString(),
    };

    // Auto-set completed_at when status changes to completed
    if (validationResult.data.status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    } else if (validationResult.data.status) {
      updateData.completed_at = null;
    }

    const { data: task, error } = await supabaseAny
      .from('tasks')
      .update(updateData)
      .eq('id', id)
      .eq('project_id', project.id)
      .select()
      .single();

    if (error || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Emit automation events
    if (validationResult.data.status === 'completed') {
      emitAutomationEvent({
        projectId: project.id,
        triggerType: 'task.completed',
        entityType: 'task',
        entityId: id,
        data: task as Record<string, unknown>,
      });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.updated',
      entityType: 'task',
      entityId: id,
      data: task as Record<string, unknown>,
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error('Error in PATCH /api/projects/[slug]/tasks/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/tasks/[id] - Delete task
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

    const membershipRole = await getProjectMembershipRole(supabase, user.id, project.id);
    if (!membershipRole) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const existingTask = await getTaskRecord(supabaseAny, project.id, id);
    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (existingTask.case_id) {
      const canDeleteCases = await canAccessCommunityResource(supabase, user.id, project.id, 'cases', 'delete');
      if (!canDeleteCases) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    if (existingTask.incident_id) {
      const canDeleteIncidents = await canAccessCommunityResource(supabase, user.id, project.id, 'incidents', 'delete');
      if (!canDeleteIncidents) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const { data: deletedTask, error } = await supabaseAny
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('project_id', project.id)
      .select()
      .single();

    if (error || !deletedTask) {
      if (error?.code === 'PGRST116' || !deletedTask) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }
      console.error('Error deleting task:', error);
      return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.deleted',
      entityType: 'task',
      entityId: id,
      data: deletedTask as Record<string, unknown>,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error in DELETE /api/projects/[slug]/tasks/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

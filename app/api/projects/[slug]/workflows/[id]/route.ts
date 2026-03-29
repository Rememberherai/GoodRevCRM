import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireWorkflowPermission } from '@/lib/projects/workflow-permissions';
import { updateWorkflowSchema } from '@/lib/validators/workflow';
import { assertWorkflowTriggerSupported, normalizeWorkflowTriggerConfig } from '@/lib/workflows/trigger-config';
import { validateWorkflow } from '@/lib/workflows/validators/validate-workflow';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/workflows/[id]
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id, project_type').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireWorkflowPermission(supabase, user.id, project, 'view');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { data: workflow, error } = await supabaseAny
      .from('workflows').select('*')
      .eq('id', id).eq('project_id', project.id).single();

    if (error || !workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    return NextResponse.json({ workflow });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /api/projects/[slug]/workflows/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/workflows/[id]
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id, project_type').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireWorkflowPermission(supabase, user.id, project, 'update');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Get current workflow
    const { data: existing } = await supabaseAny
      .from('workflows').select('*')
      .eq('id', id).eq('project_id', project.id).single();
    if (!existing) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });

    const body = await request.json();
    const validationResult = updateWorkflowSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    let updates = validationResult.data;

    if (updates.trigger_type !== undefined) {
      try {
        assertWorkflowTriggerSupported(updates.trigger_type);
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Unsupported workflow trigger' },
          { status: 400 }
        );
      }
    }

    if (updates.trigger_config !== undefined) {
      const effectiveTriggerType = updates.trigger_type ?? existing.trigger_type;
      updates = {
        ...updates,
        trigger_config: normalizeWorkflowTriggerConfig(
          effectiveTriggerType,
          updates.trigger_config,
        ),
      };
    }

    const { change_summary, ...workflowUpdates } = updates;

    // RBAC: only admin/owner can toggle is_active (matches /activate endpoint)
    if (workflowUpdates.is_active !== undefined) {
      await requireWorkflowPermission(supabase, user.id, project, 'manage');
    }

    // Validate graph if definition changed
    if (workflowUpdates.definition && workflowUpdates.definition.nodes.length > 0) {
      const graphErrors = validateWorkflow(workflowUpdates.definition);
      const blockingErrors = graphErrors.filter((e) => e.severity === 'error');
      const willBeActive = workflowUpdates.is_active ?? existing.is_active;
      if (blockingErrors.length > 0 && willBeActive) {
        return NextResponse.json(
          { error: 'Cannot activate workflow with validation errors', validation_errors: blockingErrors },
          { status: 400 }
        );
      }
    }

    // Auto-version when graph or trigger behavior changes
    const versionChanged =
      workflowUpdates.definition !== undefined ||
      workflowUpdates.trigger_type !== undefined ||
      workflowUpdates.trigger_config !== undefined;
    const newVersion = versionChanged ? existing.current_version + 1 : existing.current_version;

    const { data: workflow, error } = await supabaseAny
      .from('workflows')
      .update({
        ...workflowUpdates,
        ...(versionChanged ? { current_version: newVersion } : {}),
      })
      .eq('id', id)
      .eq('project_id', project.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating workflow:', error);
      return NextResponse.json({ error: 'Failed to update workflow' }, { status: 500 });
    }

    // Create version record when execution behavior changed
    if (versionChanged) {
      const { error: versionError } = await supabaseAny.from('workflow_versions').insert({
        workflow_id: id,
        version: newVersion,
        definition: workflow.definition,
        trigger_type: workflow.trigger_type,
        trigger_config: workflow.trigger_config,
        change_summary: change_summary || `Version ${newVersion}`,
        created_by: user.id,
      });
      if (versionError) console.error('Failed to create workflow version:', versionError.message);
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.updated',
      entityType: 'workflow',
      entityId: id,
      data: { workflow_name: workflow.name, workflow_id: id },
    }).catch(console.error);

    return NextResponse.json({ workflow });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in PATCH /api/projects/[slug]/workflows/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/workflows/[id]
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id, project_type').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireWorkflowPermission(supabase, user.id, project, 'delete');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { error } = await supabaseAny
      .from('workflows').delete()
      .eq('id', id).eq('project_id', project.id);

    if (error) {
      console.error('Error deleting workflow:', error);
      return NextResponse.json({ error: 'Failed to delete workflow' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in DELETE /api/projects/[slug]/workflows/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateWorkflowSchema } from '@/lib/validators/workflow';
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
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { data: membership } = await supabaseAny
      .from('project_memberships').select('role')
      .eq('project_id', project.id).eq('user_id', user.id).single();
    if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const { data: workflow, error } = await supabaseAny
      .from('workflows').select('*')
      .eq('id', id).eq('project_id', project.id).single();

    if (error || !workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    return NextResponse.json({ workflow });
  } catch (error) {
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
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { data: membership } = await supabaseAny
      .from('project_memberships').select('role')
      .eq('project_id', project.id).eq('user_id', user.id).single();
    if (!membership || !['owner', 'admin', 'member'].includes(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

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

    const updates = validationResult.data;
    const { change_summary, ...workflowUpdates } = updates;

    // RBAC: only admin/owner can toggle is_active (matches /activate endpoint)
    if (workflowUpdates.is_active !== undefined && !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Admin role required to change active status' }, { status: 403 });
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

    // Auto-version if definition changed
    const definitionChanged = workflowUpdates.definition !== undefined;
    const newVersion = definitionChanged ? existing.current_version + 1 : existing.current_version;

    const { data: workflow, error } = await supabaseAny
      .from('workflows')
      .update({
        ...workflowUpdates,
        ...(definitionChanged ? { current_version: newVersion } : {}),
      })
      .eq('id', id)
      .eq('project_id', project.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating workflow:', error);
      return NextResponse.json({ error: 'Failed to update workflow' }, { status: 500 });
    }

    // Create version record if definition changed
    if (definitionChanged) {
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
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { data: membership } = await supabaseAny
      .from('project_memberships').select('role')
      .eq('project_id', project.id).eq('user_id', user.id).single();
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Admin role required to delete workflows' }, { status: 403 });
    }

    const { error } = await supabaseAny
      .from('workflows').delete()
      .eq('id', id).eq('project_id', project.id);

    if (error) {
      console.error('Error deleting workflow:', error);
      return NextResponse.json({ error: 'Failed to delete workflow' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/projects/[slug]/workflows/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

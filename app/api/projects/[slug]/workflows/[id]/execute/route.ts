import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { executeWorkflowSchema } from '@/lib/validators/workflow';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// POST /api/projects/[slug]/workflows/[id]/execute - Manual trigger
export async function POST(request: Request, context: RouteContext) {
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
      return NextResponse.json({ error: 'Member role required' }, { status: 403 });
    }

    const { data: workflow } = await supabaseAny
      .from('workflows').select('*')
      .eq('id', id).eq('project_id', project.id).single();
    if (!workflow) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const validationResult = executeWorkflowSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { entity_type, entity_id, context_data } = validationResult.data;

    // Create execution record
    const { data: execution, error } = await supabaseAny
      .from('workflow_executions')
      .insert({
        workflow_id: id,
        workflow_version: workflow.current_version,
        trigger_event: { type: 'manual', triggered_by: user.id, ...validationResult.data },
        status: 'running',
        entity_type: entity_type || null,
        entity_id: entity_id || null,
        context_data: context_data || {},
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating workflow execution:', error);
      return NextResponse.json({ error: 'Failed to start execution' }, { status: 500 });
    }

    // Update execution count (read was already done above, minor race acceptable for manual triggers)
    await supabaseAny.from('workflows')
      .update({
        execution_count: (workflow.execution_count ?? 0) + 1,
        last_executed_at: new Date().toISOString(),
      })
      .eq('id', id);

    // Fire workflow engine asynchronously (don't block the response)
    import('@/lib/workflows/engine').then(({ executeWorkflow }) => {
      executeWorkflow(id, execution.id, project.id, workflow.definition, context_data || {}).catch((err) =>
        console.error('Workflow execution error:', err)
      );
    });

    return NextResponse.json({ execution }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /workflows/[id]/execute:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

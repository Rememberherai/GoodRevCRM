import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireWorkflowPermission } from '@/lib/projects/workflow-permissions';
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
      .from('projects').select('id, project_type').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireWorkflowPermission(supabase, user.id, project, 'execute');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

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

    // Validate that entity belongs to this project
    if (entity_type && entity_id) {
      const entityTableMap: Record<string, string> = {
        person: 'people',
        organization: 'organizations',
        opportunity: 'opportunities',
        household: 'households',
        case: 'household_cases',
        sequence: 'sequences',
        broadcast: 'broadcasts',
        contract: 'contracts',
        document: 'contract_documents',
        incident: 'incidents',
      };
      const tableName = entityTableMap[entity_type];
      if (tableName) {
        const { data: entityRow, error: entityError } = await supabaseAny
          .from(tableName)
          .select('id')
          .eq('id', entity_id)
          .eq('project_id', project.id)
          .maybeSingle();

        if (entityError) {
          console.error('Error validating entity:', entityError.message);
          return NextResponse.json({ error: 'Failed to validate entity' }, { status: 500 });
        }
        if (!entityRow) {
          return NextResponse.json({ error: 'Entity not found in this project' }, { status: 404 });
        }
      }
    }

    // Use RPC for atomic execution creation + count increment
    const { data: executionId, error: rpcError } = await supabaseAny.rpc('log_workflow_execution', {
      p_workflow_id: id,
      p_workflow_version: workflow.current_version,
      p_trigger_event: { type: 'manual', triggered_by: user.id, ...validationResult.data },
      p_status: 'running',
      p_entity_type: entity_type || null,
      p_entity_id: entity_id || null,
    });

    if (rpcError || !executionId) {
      console.error('Error creating workflow execution:', rpcError);
      return NextResponse.json({ error: 'Failed to start execution' }, { status: 500 });
    }

    // Set context_data on the execution (RPC doesn't accept it)
    if (context_data && Object.keys(context_data).length > 0) {
      const { error: ctxError } = await supabaseAny.from('workflow_executions')
        .update({ context_data })
        .eq('id', executionId);
      if (ctxError) {
        console.error('Failed to set execution context_data:', ctxError.message);
      }
    }

    // Fetch the created execution for the response
    const { data: execution, error: fetchError } = await supabaseAny
      .from('workflow_executions')
      .select('*')
      .eq('id', executionId)
      .single();
    if (fetchError || !execution) {
      console.error('Failed to fetch created execution:', fetchError?.message);
      return NextResponse.json({ error: 'Execution created but failed to fetch' }, { status: 500 });
    }

    // Fire workflow engine asynchronously (don't block the response)
    // Pre-import to catch module errors synchronously, then run async
    const { executeWorkflow } = await import('@/lib/workflows/engine');
    executeWorkflow(id, executionId, project.id, workflow.definition, context_data || {}).catch(async (err) => {
      console.error('Workflow execution error:', err);
      // Mark execution as failed if engine throws
      await supabaseAny.from('workflow_executions')
        .update({ status: 'failed', error_message: err instanceof Error ? err.message : String(err), completed_at: new Date().toISOString() })
        .eq('id', executionId);
    });

    return NextResponse.json({ execution }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in POST /workflows/[id]/execute:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

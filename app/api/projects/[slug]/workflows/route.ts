import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireWorkflowPermission } from '@/lib/projects/workflow-permissions';
import { createWorkflowSchema, workflowQuerySchema } from '@/lib/validators/workflow';
import { assertWorkflowTriggerSupported, normalizeWorkflowTriggerConfig } from '@/lib/workflows/trigger-config';
import { validateWorkflow } from '@/lib/workflows/validators/validate-workflow';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/workflows - List workflows
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await requireWorkflowPermission(supabase, user.id, project, 'view');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { searchParams } = new URL(request.url);
    const queryResult = workflowQuerySchema.safeParse({
      is_active: searchParams.get('is_active') ?? undefined,
      is_template: searchParams.get('is_template') ?? undefined,
      trigger_type: searchParams.get('trigger_type') ?? undefined,
      tag: searchParams.get('tag') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { is_active, is_template, trigger_type, tag, search, limit, offset } = queryResult.data;

    let query = supabaseAny
      .from('workflows')
      .select('id, project_id, name, description, is_active, is_template, trigger_type, trigger_config, current_version, execution_count, last_executed_at, tags, created_by, created_at, updated_at')
      .eq('project_id', project.id);

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active);
    }
    if (is_template !== undefined) {
      query = query.eq('is_template', is_template);
    }
    if (trigger_type) {
      query = query.eq('trigger_type', trigger_type);
    }
    if (tag) {
      query = query.contains('tags', [tag]);
    }
    if (search) {
      // Escape PostgREST special chars to prevent filter injection
      const s = search.replace(/[%_\\]/g, '\\$&').replace(/"/g, '""').replace(/[,()]/g, '');
      query = query.or(`name.ilike."%${s}%",description.ilike."%${s}%"`);
    }

    const { data: workflows, error } = await query
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching workflows:', error);
      return NextResponse.json({ error: 'Failed to fetch workflows' }, { status: 500 });
    }

    return NextResponse.json({
      workflows: workflows ?? [],
      pagination: { limit, offset },
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/workflows:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/workflows - Create workflow
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await requireWorkflowPermission(supabase, user.id, project, 'create');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const body = await request.json();
    const validationResult = createWorkflowSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    try {
      assertWorkflowTriggerSupported(validationResult.data.trigger_type);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Unsupported workflow trigger' },
        { status: 400 }
      );
    }

    const workflowInput = {
      ...validationResult.data,
      trigger_config: normalizeWorkflowTriggerConfig(
        validationResult.data.trigger_type,
        validationResult.data.trigger_config,
      ),
    };

    // Validate workflow graph if definition has nodes
    const { definition } = workflowInput;
    if (definition.nodes.length > 0) {
      const graphErrors = validateWorkflow(definition);
      const blockingErrors = graphErrors.filter((e) => e.severity === 'error');
      if (blockingErrors.length > 0 && workflowInput.is_active) {
        return NextResponse.json(
          { error: 'Cannot activate workflow with validation errors', validation_errors: blockingErrors },
          { status: 400 }
        );
      }
    }

    const { data: workflow, error } = await supabaseAny
      .from('workflows')
      .insert({
        project_id: project.id,
        created_by: user.id,
        ...workflowInput,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating workflow:', error);
      return NextResponse.json({ error: 'Failed to create workflow' }, { status: 500 });
    }

    // Create initial version
    await supabaseAny.from('workflow_versions').insert({
      workflow_id: workflow.id,
      version: 1,
      definition: workflow.definition,
      trigger_type: workflow.trigger_type,
      trigger_config: workflow.trigger_config,
      change_summary: 'Initial version',
      created_by: user.id,
    });

    // Emit automation event
    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.created',
      entityType: 'workflow',
      entityId: workflow.id,
      data: { workflow_name: workflow.name, workflow_id: workflow.id },
    }).catch(console.error);

    return NextResponse.json({ workflow }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/workflows:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

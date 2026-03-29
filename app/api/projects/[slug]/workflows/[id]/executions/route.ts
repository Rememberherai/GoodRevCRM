import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireWorkflowPermission } from '@/lib/projects/workflow-permissions';
import { workflowExecutionQuerySchema } from '@/lib/validators/workflow';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/workflows/[id]/executions
export async function GET(request: Request, context: RouteContext) {
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

    const { searchParams } = new URL(request.url);
    const queryResult = workflowExecutionQuerySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { status, limit, offset } = queryResult.data;

    // Verify workflow belongs to this project
    const { data: workflow } = await supabaseAny
      .from('workflows').select('id')
      .eq('id', id).eq('project_id', project.id).single();
    if (!workflow) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });

    let query = supabaseAny
      .from('workflow_executions').select('*')
      .eq('workflow_id', id);

    if (status) query = query.eq('status', status);

    const { data: executions, error } = await query
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching executions:', error);
      return NextResponse.json({ error: 'Failed to fetch executions' }, { status: 500 });
    }

    return NextResponse.json({ executions: executions ?? [], pagination: { limit, offset } });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /workflows/[id]/executions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

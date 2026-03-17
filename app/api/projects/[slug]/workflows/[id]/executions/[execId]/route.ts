import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ slug: string; id: string; execId: string }>;
}

// GET /api/projects/[slug]/workflows/[id]/executions/[execId]
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id, execId } = await context.params;
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

    // Verify workflow belongs to this project
    const { data: workflow } = await supabaseAny
      .from('workflows').select('id')
      .eq('id', id).eq('project_id', project.id).single();
    if (!workflow) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });

    const { data: execution, error: execError } = await supabaseAny
      .from('workflow_executions').select('*')
      .eq('id', execId).eq('workflow_id', id).single();

    if (execError || !execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }

    const { data: steps } = await supabaseAny
      .from('workflow_step_executions').select('*')
      .eq('execution_id', execId)
      .order('created_at', { ascending: true });

    return NextResponse.json({ execution, steps: steps ?? [] });
  } catch (error) {
    console.error('Error in GET /workflows/[id]/executions/[execId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

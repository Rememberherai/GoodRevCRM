import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { automationExecutionQuerySchema } from '@/lib/validators/automation';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/automations/[id]/executions - List execution history
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const queryResult = automationExecutionQuerySchema.safeParse({
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Verify automation belongs to this project
    const { data: automation } = await supabaseAny
      .from('automations')
      .select('id')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (!automation) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }

    let query = supabaseAny
      .from('automation_executions')
      .select('*')
      .eq('automation_id', id);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: executions, error } = await query
      .order('executed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching automation executions:', error);
      return NextResponse.json({ error: 'Failed to fetch executions' }, { status: 500 });
    }

    return NextResponse.json({
      executions: executions ?? [],
      pagination: { limit, offset },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/automations/[id]/executions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

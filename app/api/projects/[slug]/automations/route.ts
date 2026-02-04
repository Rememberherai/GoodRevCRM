import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createAutomationSchema, automationQuerySchema } from '@/lib/validators/automation';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/automations - List automations
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
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const queryResult = automationQuerySchema.safeParse({
      is_active: searchParams.get('is_active') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { is_active, limit, offset } = queryResult.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    let query = supabaseAny
      .from('automations')
      .select('*')
      .eq('project_id', project.id);

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active);
    }

    const { data: automations, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching automations:', error);
      return NextResponse.json({ error: 'Failed to fetch automations' }, { status: 500 });
    }

    return NextResponse.json({
      automations: automations ?? [],
      pagination: { limit, offset },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/automations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/automations - Create automation
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
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Check admin role
    const { data: membership } = await supabaseAny
      .from('project_memberships')
      .select('role')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Admin role required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validationResult = createAutomationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { data: automation, error } = await supabaseAny
      .from('automations')
      .insert({
        project_id: project.id,
        created_by: user.id,
        ...validationResult.data,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating automation:', error);
      return NextResponse.json({ error: 'Failed to create automation' }, { status: 500 });
    }

    return NextResponse.json({ automation }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/automations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

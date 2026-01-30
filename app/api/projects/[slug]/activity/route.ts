import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { activityQuerySchema, createActivitySchema } from '@/lib/validators/activity';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/activity - List activity log
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
    const queryResult = activityQuerySchema.safeParse({
      entity_type: searchParams.get('entity_type') ?? undefined,
      entity_id: searchParams.get('entity_id') ?? undefined,
      action: searchParams.get('action') ?? undefined,
      user_id: searchParams.get('user_id') ?? undefined,
      start_date: searchParams.get('start_date') ?? undefined,
      end_date: searchParams.get('end_date') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { entity_type, entity_id, action, user_id, start_date, end_date, limit, offset } =
      queryResult.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    let query = supabaseAny
      .from('activity_log')
      .select('*, user:users!activity_log_user_id_fkey(id, full_name, email, avatar_url)')
      .eq('project_id', project.id);

    if (entity_type) query = query.eq('entity_type', entity_type);
    if (entity_id) query = query.eq('entity_id', entity_id);
    if (action) query = query.eq('action', action);
    if (user_id) query = query.eq('user_id', user_id);
    if (start_date) query = query.gte('created_at', start_date);
    if (end_date) query = query.lte('created_at', end_date);

    const { data: activities, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching activity:', error);
      return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
    }

    return NextResponse.json({
      activities: activities ?? [],
      pagination: { limit, offset },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/activity:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/activity - Create activity entry
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

    const body = await request.json();
    const validationResult = createActivitySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Get request metadata
    const ipAddress = request.headers.get('x-forwarded-for') ?? null;
    const userAgent = request.headers.get('user-agent') ?? null;

    const { data: activity, error } = await supabaseAny
      .from('activity_log')
      .insert({
        project_id: project.id,
        user_id: user.id,
        ...validationResult.data,
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating activity:', error);
      return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 });
    }

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/activity:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

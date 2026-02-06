import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createImportJobSchema, importJobQuerySchema } from '@/lib/validators/import-export';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/import - List import jobs
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
    const queryResult = importJobQuerySchema.safeParse({
      entity_type: searchParams.get('entity_type') ?? undefined,
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

    const { entity_type, status, limit, offset } = queryResult.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    let query = supabaseAny
      .from('import_jobs')
      .select('*')
      .eq('project_id', project.id);

    if (entity_type) query = query.eq('entity_type', entity_type);
    if (status) query = query.eq('status', status);

    const { data: jobs, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching import jobs:', error);
      return NextResponse.json({ error: 'Failed to fetch import jobs' }, { status: 500 });
    }

    return NextResponse.json({
      jobs: jobs ?? [],
      pagination: { limit, offset },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/import:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/import - Create import job
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
    const validationResult = createImportJobSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { data: job, error } = await supabaseAny
      .from('import_jobs')
      .insert({
        ...validationResult.data,
        project_id: project.id,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating import job:', error);
      return NextResponse.json({ error: 'Failed to create import job' }, { status: 500 });
    }

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/import:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

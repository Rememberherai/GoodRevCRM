import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createExportJobSchema, exportJobQuerySchema } from '@/lib/validators/import-export';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/export - List export jobs
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
    const queryResult = exportJobQuerySchema.safeParse({
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
      .from('export_jobs')
      .select('*')
      .eq('project_id', project.id);

    if (entity_type) query = query.eq('entity_type', entity_type);
    if (status) query = query.eq('status', status);

    const { data: jobs, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching export jobs:', error);
      return NextResponse.json({ error: 'Failed to fetch export jobs' }, { status: 500 });
    }

    return NextResponse.json({
      jobs: jobs ?? [],
      pagination: { limit, offset },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/export:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/export - Create export job
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
    const validationResult = createExportJobSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Set default expiration (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const { data: job, error } = await supabaseAny
      .from('export_jobs')
      .insert({
        ...validationResult.data,
        project_id: project.id,
        user_id: user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating export job:', error);
      return NextResponse.json({ error: 'Failed to create export job' }, { status: 500 });
    }

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/export:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

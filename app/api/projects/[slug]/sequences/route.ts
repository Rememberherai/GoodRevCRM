import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createSequenceSchema, sequenceQuerySchema } from '@/lib/validators/sequence';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/sequences - List sequences
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
    const queryResult = sequenceQuerySchema.safeParse({
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

    let query = supabaseAny
      .from('sequences')
      .select(`
        *,
        steps:sequence_steps(count),
        enrollments:sequence_enrollments(count)
      `)
      .eq('project_id', project.id);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: sequences, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching sequences:', error);
      return NextResponse.json({ error: 'Failed to fetch sequences' }, { status: 500 });
    }

    return NextResponse.json({
      sequences: sequences ?? [],
      pagination: { limit, offset },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/sequences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/sequences - Create sequence
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
    const validationResult = createSequenceSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { data: sequence, error } = await supabaseAny
      .from('sequences')
      .insert({
        project_id: project.id,
        ...validationResult.data,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating sequence:', error);
      return NextResponse.json({ error: 'Failed to create sequence' }, { status: 500 });
    }

    return NextResponse.json(sequence, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/sequences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

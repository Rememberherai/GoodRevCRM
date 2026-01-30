import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createTagSchema, tagQuerySchema } from '@/lib/validators/bulk';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/tags - List tags
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
    const queryResult = tagQuerySchema.safeParse({
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

    const { search, limit, offset } = queryResult.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    let query = supabaseAny
      .from('entity_tags')
      .select('*')
      .eq('project_id', project.id);

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data: tags, error } = await query
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching tags:', error);
      return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
    }

    return NextResponse.json({
      tags: tags ?? [],
      pagination: { limit, offset },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/tags:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/tags - Create tag
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
    const validationResult = createTagSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { data: tag, error } = await supabaseAny
      .from('entity_tags')
      .insert({
        project_id: project.id,
        ...validationResult.data,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Tag with this name already exists' }, { status: 409 });
      }
      console.error('Error creating tag:', error);
      return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 });
    }

    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/tags:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createTemplateSchema, templateQuerySchema } from '@/lib/validators/email-template';

// GET /api/projects/[slug]/templates - List templates
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse query params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const queryResult = templateQuerySchema.safeParse(searchParams);

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { category, is_active, is_shared, search, limit, offset } = queryResult.data;

    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('email_templates')
      .select('*', { count: 'exact' })
      .eq('project_id', project.id)
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (category) {
      query = query.eq('category', category);
    }

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active);
    }

    if (is_shared !== undefined) {
      query = query.eq('is_shared', is_shared);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,subject.ilike.%${search}%`);
    }

    const { data: templates, error, count } = await query;

    if (error) {
      console.error('Error fetching templates:', error);
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }

    return NextResponse.json({
      data: templates,
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/templates - Create template
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse and validate body
    const body = await request.json();
    const validationResult = createTemplateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: template, error: createError } = await (supabase as any)
      .from('email_templates')
      .insert({
        project_id: project.id,
        created_by: user.id,
        ...validationResult.data,
      })
      .select()
      .single();

    if (createError) {
      if (createError.code === '23505') {
        return NextResponse.json(
          { error: 'A template with this name already exists' },
          { status: 409 }
        );
      }
      console.error('Error creating template:', createError);
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
    }

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

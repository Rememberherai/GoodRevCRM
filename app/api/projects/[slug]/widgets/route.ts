import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createWidgetSchema, widgetQuerySchema } from '@/lib/validators/report';

// GET /api/projects/[slug]/widgets - List user's widgets
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
    const queryResult = widgetQuerySchema.safeParse(searchParams);

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { widget_type, is_visible } = queryResult.data;

    // Build query - use any for dynamic table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('dashboard_widgets')
      .select('*')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .order('position', { ascending: true });

    if (widget_type) {
      query = query.eq('widget_type', widget_type);
    }

    if (is_visible !== undefined) {
      query = query.eq('is_visible', is_visible);
    }

    const { data: widgets, error } = await query;

    if (error) {
      console.error('Error fetching widgets:', error);
      return NextResponse.json({ error: 'Failed to fetch widgets' }, { status: 500 });
    }

    return NextResponse.json({ data: widgets });
  } catch (error) {
    console.error('Error fetching widgets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/widgets - Create widget
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
    const validationResult = createWidgetSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // Check if widget of this type already exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from('dashboard_widgets')
      .select('id')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .eq('widget_type', validationResult.data.widget_type)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Widget of this type already exists' },
        { status: 409 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: widget, error: createError } = await (supabase as any)
      .from('dashboard_widgets')
      .insert({
        project_id: project.id,
        user_id: user.id,
        ...validationResult.data,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating widget:', createError);
      return NextResponse.json({ error: 'Failed to create widget' }, { status: 500 });
    }

    return NextResponse.json(widget, { status: 201 });
  } catch (error) {
    console.error('Error creating widget:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

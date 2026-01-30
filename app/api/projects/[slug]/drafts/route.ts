import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createDraftSchema, draftQuerySchema } from '@/lib/validators/email-template';

// GET /api/projects/[slug]/drafts - List user's drafts
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
    const queryResult = draftQuerySchema.safeParse(searchParams);

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { status, template_id, limit, offset } = queryResult.data;

    // Build query - user can only see their own drafts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('email_drafts')
      .select('*', { count: 'exact' })
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (template_id) {
      query = query.eq('template_id', template_id);
    }

    const { data: drafts, error, count } = await query;

    if (error) {
      console.error('Error fetching drafts:', error);
      return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 });
    }

    return NextResponse.json({
      data: drafts,
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Error fetching drafts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/drafts - Create draft
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
    const validationResult = createDraftSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // Determine status based on scheduled_at
    const status = validationResult.data.scheduled_at ? 'scheduled' : 'draft';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: draft, error: createError } = await (supabase as any)
      .from('email_drafts')
      .insert({
        project_id: project.id,
        user_id: user.id,
        status,
        ...validationResult.data,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating draft:', createError);
      return NextResponse.json({ error: 'Failed to create draft' }, { status: 500 });
    }

    return NextResponse.json(draft, { status: 201 });
  } catch (error) {
    console.error('Error creating draft:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { versionQuerySchema } from '@/lib/validators/email-template';

// GET /api/projects/[slug]/templates/[id]/versions - List template versions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
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

    // Verify template exists and belongs to project
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: template, error: templateError } = await (supabase as any)
      .from('email_templates')
      .select('id')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Parse query params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const queryResult = versionQuerySchema.safeParse(searchParams);

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { limit, offset } = queryResult.data;

    // Get versions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: versions, error, count } = await (supabase as any)
      .from('email_template_versions')
      .select('*', { count: 'exact' })
      .eq('template_id', id)
      .order('version', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching versions:', error);
      return NextResponse.json({ error: 'Failed to fetch versions' }, { status: 500 });
    }

    return NextResponse.json({
      data: versions,
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Error fetching versions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

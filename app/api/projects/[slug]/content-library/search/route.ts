import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { searchContentLibrarySchema } from '@/lib/validators/rfp-content-library';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// POST /api/projects/[slug]/content-library/search - Search for similar entries
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

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const validationResult = searchContentLibrarySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { query, category, limit } = validationResult.data;

    let dbQuery = supabase
      .from('rfp_content_library')
      .select('*')
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .textSearch(
        'answer_text',
        query,
        { type: 'websearch' }
      )
      .limit(limit);

    if (category) {
      dbQuery = dbQuery.eq('category', category);
    }

    const { data: entries, error } = await dbQuery;

    if (error) {
      console.error('Error searching content library:', error);
      return NextResponse.json({ error: 'Failed to search content library' }, { status: 500 });
    }

    return NextResponse.json({ entries: entries ?? [] });
  } catch (error) {
    console.error('Error in POST /api/.../content-library/search:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

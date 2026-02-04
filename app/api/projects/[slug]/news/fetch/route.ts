import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { fetchNewsForProject } from '@/lib/newsapi/fetcher';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// POST /api/projects/[slug]/news/fetch
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
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

    const result = await fetchNewsForProject(project.id);

    return NextResponse.json({
      fetched: result.articlesProcessed,
      tokensUsed: result.tokensUsed,
      tokensRemaining: result.tokensRemaining,
      errors: result.errors.length ? result.errors : undefined,
    });
  } catch (error) {
    console.error('[News Fetch POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

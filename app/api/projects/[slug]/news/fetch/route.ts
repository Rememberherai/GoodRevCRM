import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { fetchNewsForProject } from '@/lib/newsapi/fetcher';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const MIN_FETCH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

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

    // Rate limit: check last fetch time
    const adminClient = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lastFetch } = await (adminClient as any)
      .from('news_fetch_log')
      .select('fetched_at')
      .eq('project_id', project.id)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    if (lastFetch) {
      const elapsed = Date.now() - new Date(lastFetch.fetched_at).getTime();
      if (elapsed < MIN_FETCH_INTERVAL_MS) {
        const waitMinutes = Math.ceil((MIN_FETCH_INTERVAL_MS - elapsed) / 60000);
        return NextResponse.json(
          { error: `Please wait ${waitMinutes} minute(s) before fetching again` },
          { status: 429 }
        );
      }
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

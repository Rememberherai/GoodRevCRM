import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/news/articles
export async function GET(request: Request, context: RouteContext) {
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = parseInt(searchParams.get('limit') ?? '20', 10);
    const keyword = searchParams.get('keyword');
    const starred = searchParams.get('starred');
    const search = searchParams.get('search');
    const orgId = searchParams.get('org_id');

    const offset = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('news_articles')
      .select('*', { count: 'exact' })
      .eq('project_id', project.id)
      .order('published_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (keyword) {
      query = query.contains('matched_keywords', [keyword]);
    }

    if (starred === 'true') {
      query = query.eq('is_starred', true);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data: articles, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If filtering by org, get articles linked to that org
    let filteredArticles = articles || [];
    if (orgId && articles?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: entityLinks } = await (supabase as any)
        .from('news_article_entities')
        .select('article_id')
        .eq('organization_id', orgId)
        .in('article_id', articles.map((a: any) => a.id));

      const linkedIds = new Set((entityLinks || []).map((l: any) => l.article_id));
      filteredArticles = articles.filter((a: any) => linkedIds.has(a.id));
    }

    // Fetch linked organizations for each article
    if (filteredArticles.length) {
      const articleIds = filteredArticles.map((a: any) => a.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: entityLinks } = await (supabase as any)
        .from('news_article_entities')
        .select('article_id, organization_id')
        .in('article_id', articleIds);

      if (entityLinks?.length) {
        const orgIds = [...new Set(entityLinks.map((l: any) => l.organization_id))];
        const { data: orgs } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', orgIds as string[]);

        const orgMap = new Map((orgs || []).map((o: any) => [o.id, o.name]));

        filteredArticles = filteredArticles.map((article: any) => ({
          ...article,
          linked_organizations: entityLinks
            .filter((l: any) => l.article_id === article.id)
            .map((l: any) => ({
              id: l.organization_id,
              name: orgMap.get(l.organization_id) || 'Unknown',
            })),
        }));
      }
    }

    return NextResponse.json({
      articles: filteredArticles,
      pagination: {
        page,
        limit,
        total: orgId ? filteredArticles.length : (count ?? 0),
        totalPages: Math.ceil((orgId ? filteredArticles.length : (count ?? 0)) / limit),
      },
    });
  } catch (error) {
    console.error('[News Articles GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

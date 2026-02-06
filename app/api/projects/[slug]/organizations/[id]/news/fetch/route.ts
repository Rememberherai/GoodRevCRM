import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { fetchNewsForOrganization } from '@/lib/newsapi/fetcher';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// POST /api/projects/[slug]/organizations/[id]/news/fetch
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { slug, id: organizationId } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get organization
    const { data: organization } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', organizationId)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const result = await fetchNewsForOrganization(
      project.id,
      organization.id,
      organization.name
    );

    return NextResponse.json({
      fetched: result.articlesProcessed,
      tokensUsed: result.tokensUsed,
      tokensRemaining: result.tokensRemaining,
      organizationName: organization.name,
      errors: result.errors.length ? result.errors : undefined,
    });
  } catch (error) {
    console.error('[Org News Fetch POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

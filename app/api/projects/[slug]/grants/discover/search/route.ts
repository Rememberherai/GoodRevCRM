import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { getProjectOpenRouterClient } from '@/lib/openrouter/client';
import { isApiKeyMissingError, apiKeyMissingResponse } from '@/lib/secrets';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/grants/discover/search?q=...
// Uses Grok web search to find grant opportunities
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project || !['community', 'grants'].includes(project.project_type))
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'grants', 'view');

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    const openrouter = await getProjectOpenRouterClient(project.id);

    const result = await openrouter.chat(
      [
        {
          role: 'user',
          content: `Search for grant funding opportunities related to: "${query}"

Find current or upcoming grants, RFPs, and funding announcements. Focus on:
- Government grants (federal, state, local)
- Foundation and nonprofit grants
- Corporate giving programs

For each opportunity found, provide a JSON array with objects containing:
- title: Grant/opportunity name
- funder: Organization offering the grant
- url: Direct link to the opportunity page
- amount: Estimated funding amount (if available, otherwise null)
- deadline: Application deadline (if available, otherwise null)
- description: Brief 1-2 sentence summary
- eligibility: Who can apply (if mentioned)

Return ONLY a JSON array, no markdown or other text. Return up to 10 results.`,
        },
      ],
      {
        model: 'x-ai/grok-4.1-fast',
        webSearch: true,
        responseFormat: 'json_object',
        maxTokens: 4096,
      }
    );

    let opportunities = [];
    try {
      const content = result.choices[0]?.message.content ?? '[]';
      const parsed = JSON.parse(content);
      opportunities = Array.isArray(parsed) ? parsed : parsed.results ?? parsed.opportunities ?? [];
    } catch {
      opportunities = [];
    }

    return NextResponse.json({ opportunities, query });
  } catch (error) {
    if (isApiKeyMissingError(error)) return apiKeyMissingResponse(error);
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /grants/discover/search:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

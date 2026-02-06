import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { globalSearchSchema } from '@/lib/validators/search';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/search - Global search
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const queryResult = globalSearchSchema.safeParse({
      query: searchParams.get('query') ?? undefined,
      types: searchParams.get('types')?.split(',') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { query, types, limit } = queryResult.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const sanitizedQuery = query.replace(/[%_\\]/g, '\\$&');

    // Call the global_search function
    const { data: rawResults, error } = await supabaseAny.rpc('global_search', {
      p_project_id: project.id,
      p_query: sanitizedQuery,
      p_entity_types: types,
      p_limit: limit,
    });

    if (error) {
      console.error('Error performing search:', error);
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }

    // Transform results to match frontend expected format
    const results = (rawResults ?? []).map((r: { entity_id: string; entity_type: string; name: string; subtitle: string | null; match_field: string; relevance: number }) => ({
      id: r.entity_id,
      type: r.entity_type,
      title: r.name,
      subtitle: r.subtitle,
      metadata: {
        match_field: r.match_field,
        relevance: r.relevance,
      },
    }));

    // Group results by type
    const grouped = {
      people: [] as typeof results,
      organizations: [] as typeof results,
      opportunities: [] as typeof results,
      rfps: [] as typeof results,
      tasks: [] as typeof results,
      notes: [] as typeof results,
    };

    for (const result of results) {
      const type = result.type as keyof typeof grouped;
      if (grouped[type]) {
        grouped[type].push(result);
      }
    }

    return NextResponse.json({
      results,
      grouped,
      query,
      total: results.length,
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/search:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

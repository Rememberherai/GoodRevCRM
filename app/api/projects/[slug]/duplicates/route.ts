import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/duplicates - List duplicate candidates
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
    const entityType = searchParams.get('entity_type');
    const status = searchParams.get('status') ?? 'pending';
    const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
    const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
    const page = Math.max(isNaN(rawPage) ? 1 : rawPage, 1);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 100);
    const offset = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('duplicate_candidates')
      .select('*', { count: 'exact' })
      .eq('project_id', project.id)
      .eq('status', status)
      .order('match_score', { ascending: false })
      .range(offset, offset + limit - 1);

    if (entityType) {
      query = query.eq('entity_type', entityType);
    }

    const { data: candidates, error, count } = await query;

    if (error) {
      console.error('Error fetching duplicates:', error);
      return NextResponse.json({ error: 'Failed to fetch duplicates' }, { status: 500 });
    }

    // Hydrate with source and target records
    const hydrated = await Promise.all(
      (candidates ?? []).map(async (candidate: any) => {
        const table = candidate.entity_type === 'person' ? 'people' : 'organizations';
        const [{ data: source }, { data: target }] = await Promise.all([
          supabase.from(table).select('*').eq('id', candidate.source_id).single(),
          supabase.from(table).select('*').eq('id', candidate.target_id).single(),
        ]);
        return {
          ...candidate,
          source_record: source ?? null,
          target_record: target ?? null,
        };
      })
    );

    return NextResponse.json({
      candidates: hydrated,
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/duplicates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

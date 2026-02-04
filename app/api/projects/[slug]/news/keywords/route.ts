import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const addKeywordSchema = z.object({
  keyword: z.string().min(2, 'Keyword must be at least 2 characters').max(255),
});

// GET /api/projects/[slug]/news/keywords
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
    const source = searchParams.get('source');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('news_keywords')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });

    if (source) {
      query = query.eq('source', source);
    }

    const { data: keywords, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Backfill: auto-create keywords for orgs that don't have one yet
    const existingOrgKeywords = (keywords || []).filter((k: any) => k.source === 'organization');
    const orgIdsWithKeywords = new Set(existingOrgKeywords.map((k: any) => k.organization_id));

    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('project_id', project.id)
      .is('deleted_at', null);

    if (orgs?.length) {
      const missing = orgs.filter(o => o.name && o.name.length >= 3 && !orgIdsWithKeywords.has(o.id));
      if (missing.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('news_keywords')
          .upsert(
            missing.map(o => ({
              project_id: project.id,
              keyword: o.name,
              source: 'organization',
              organization_id: o.id,
              is_active: true,
              created_by: user.id,
            })),
            { onConflict: 'project_id,keyword' }
          )
          .then(({ error: bfError }: { error: { message: string } | null }) => {
            if (bfError) console.warn('[News] Backfill keywords failed:', bfError.message);
          });

        // Re-fetch to include the backfilled keywords
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: refreshedKeywords } = await (supabase as any)
          .from('news_keywords')
          .select('*')
          .eq('project_id', project.id)
          .order('created_at', { ascending: false });
        return NextResponse.json({ keywords: refreshedKeywords || [] });
      }
    }

    return NextResponse.json({ keywords: keywords || [] });
  } catch (error) {
    console.error('[News Keywords GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/news/keywords
export async function POST(request: Request, context: RouteContext) {
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

    const body = await request.json();
    const parsed = addKeywordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation failed' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: keyword, error } = await (supabase as any)
      .from('news_keywords')
      .insert({
        project_id: project.id,
        keyword: parsed.data.keyword.trim(),
        source: 'manual',
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Keyword already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ keyword }, { status: 201 });
  } catch (error) {
    console.error('[News Keywords POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getTotalTokensUsed } from '@/lib/newsapi/fetcher';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const TOKEN_LIMIT = 2000;

// GET /api/projects/[slug]/news/token-usage
export async function GET(_request: Request, context: RouteContext) {
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

    const totalTokensUsed = await getTotalTokensUsed();

    return NextResponse.json({
      total_tokens_used: totalTokensUsed,
      token_limit: TOKEN_LIMIT,
      tokens_remaining: Math.max(0, TOKEN_LIMIT - totalTokensUsed),
    });
  } catch (error) {
    console.error('[News Token Usage GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

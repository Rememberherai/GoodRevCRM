import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchNewsForAllProjects } from '@/lib/newsapi/fetcher';

/**
 * Fetch news articles for all projects.
 * Supports two auth modes:
 *   1. CRON_SECRET bearer token (for automated calls)
 *   2. Supabase session cookie (for manual trigger from UI)
 */
export async function GET(request: Request) {
  // Try CRON_SECRET auth first
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const hasCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!hasCronAuth) {
    // Fall back to user session auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    console.log('[News] Starting news fetch...');

    const result = await fetchNewsForAllProjects();

    console.log(
      `[News] News fetch complete: ${result.projectsProcessed} projects, ` +
      `${result.totalArticles} articles, ${result.totalTokensUsed} tokens used, ` +
      `${result.tokensRemaining} tokens remaining`
    );

    if (result.errors.length) {
      console.warn('[News] News fetch errors:', result.errors);
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[News] Error fetching news:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}

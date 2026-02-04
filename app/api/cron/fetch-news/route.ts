import { NextResponse } from 'next/server';
import { fetchNewsForAllProjects } from '@/lib/newsapi/fetcher';

// Cron endpoint for fetching news articles for all projects.
// Runs every 6 hours via Vercel Cron.
// Schedule: "0 */6 * * *"
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Cron] Starting news fetch...');

    const result = await fetchNewsForAllProjects();

    console.log(
      `[Cron] News fetch complete: ${result.projectsProcessed} projects, ` +
      `${result.totalArticles} articles, ${result.totalTokensUsed} tokens used, ` +
      `${result.tokensRemaining} tokens remaining`
    );

    if (result.errors.length) {
      console.warn('[Cron] News fetch errors:', result.errors);
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Cron] Error fetching news:', error);
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

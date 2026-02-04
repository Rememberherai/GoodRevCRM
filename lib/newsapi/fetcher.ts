import { createAdminClient } from '@/lib/supabase/admin';
import { NewsApiClient } from './client';
import { NewsApiError } from './types';
import type { NewsApiArticle } from './types';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { AutomationEvent } from '@/types/automation';

const TOKEN_LIMIT = 2000;
const SAFETY_BUFFER = 100; // Stop fetching at 1900 tokens

export interface FetchResult {
  articlesProcessed: number;
  tokensUsed: number;
  tokensRemaining: number;
  errors: string[];
}

/**
 * Get total tokens used across all projects
 */
export async function getTotalTokensUsed(): Promise<number> {
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('news_fetch_log')
    .select('tokens_used');

  if (error) {
    console.error('[News] Error fetching token usage:', error);
    return 0;
  }

  return (data || []).reduce((sum: number, row: any) => sum + (row.tokens_used || 0), 0);
}

/**
 * Check if we can still make API calls
 */
async function canFetch(): Promise<{ allowed: boolean; tokensUsed: number }> {
  const tokensUsed = await getTotalTokensUsed();
  return {
    allowed: tokensUsed < TOKEN_LIMIT - SAFETY_BUFFER,
    tokensUsed,
  };
}

/**
 * Determine which keywords an article matched against
 */
function findMatchedKeywords(
  article: NewsApiArticle,
  keywords: string[]
): string[] {
  const text = `${article.title} ${article.body || ''} ${article.url || ''}`.toLowerCase();
  return keywords.filter(kw => text.includes(kw.toLowerCase()));
}

/**
 * Fetch news for a specific project
 */
export async function fetchNewsForProject(projectId: string): Promise<FetchResult> {
  const supabase = createAdminClient();
  const result: FetchResult = {
    articlesProcessed: 0,
    tokensUsed: 0,
    tokensRemaining: 0,
    errors: [],
  };

  // Check token budget
  const { allowed, tokensUsed } = await canFetch();
  result.tokensRemaining = TOKEN_LIMIT - tokensUsed;

  if (!allowed) {
    result.errors.push('Token limit approaching, skipping fetch');
    return result;
  }

  // Get active keywords for this project
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: keywordRows, error: kwError } = await (supabase as any)
    .from('news_keywords')
    .select('keyword, organization_id')
    .eq('project_id', projectId)
    .eq('is_active', true);

  if (kwError || !keywordRows?.length) {
    if (kwError) result.errors.push(`Failed to fetch keywords: ${kwError.message}`);
    return result;
  }

  const keywords = keywordRows.map((k: any) => k.keyword);

  // Calculate date range (last 7 days)
  const dateEnd = new Date().toISOString().split('T')[0];
  const dateStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  let client: NewsApiClient;
  try {
    client = new NewsApiClient();
  } catch (e) {
    result.errors.push(e instanceof Error ? e.message : 'Failed to create NewsAPI client');
    return result;
  }

  // Single API call with all keywords combined via OR
  try {
    const response = await client.searchArticles({
      keywords,
      keywordOper: 'or',
      dateStart,
      dateEnd,
      sortBy: 'date',
      count: 100,
    });

    result.tokensUsed = 1; // Each search costs 1 token

    // Log the fetch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('news_fetch_log').insert({
      project_id: projectId,
      tokens_used: 1,
      articles_fetched: response.articles.results.length,
      keywords_searched: keywords,
    });

    // Get all orgs for content mention scanning
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('project_id', projectId)
      .is('deleted_at', null);

    const orgKeywordMap = new Map(
      keywordRows
        .filter((k: any) => k.organization_id)
        .map((k: any) => [k.keyword.toLowerCase(), k.organization_id!])
    );

    // Process each article
    for (const article of response.articles.results) {
      if (!article.url || !article.title) continue;

      const matchedKeywords = findMatchedKeywords(article, keywords);
      if (matchedKeywords.length === 0) {
        // The API returned it, so it matched something — use all keywords
        matchedKeywords.push(...keywords.slice(0, 1));
      }

      const authorName = article.authors?.[0]?.name || null;

      // Upsert article via RPC
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: articleId, error: upsertError } = await (supabase as any).rpc('upsert_news_article', {
        p_project_id: projectId,
        p_title: article.title,
        p_body: article.body || null,
        p_description: (article.body || '').slice(0, 300) || null,
        p_source_name: article.source?.title || null,
        p_author: authorName,
        p_url: article.url,
        p_image_url: article.image || null,
        p_published_at: article.dateTime || article.dateTimePub || null,
        p_matched_keywords: matchedKeywords,
        p_sentiment: article.sentiment ?? null,
      });

      if (upsertError) {
        result.errors.push(`Upsert error for ${article.url}: ${upsertError.message}`);
        continue;
      }

      result.articlesProcessed++;

      if (!articleId) continue;

      // Link to organizations via keyword match
      for (const kw of matchedKeywords) {
        const orgId = orgKeywordMap.get(kw.toLowerCase());
        if (orgId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from('news_article_entities').upsert(
            { article_id: articleId, organization_id: orgId, match_type: 'keyword' },
            { onConflict: 'article_id,organization_id' }
          ).then(({ error }: { error: any }) => {
            if (error) console.warn('[News] Entity link error:', error.message);
          });
        }
      }

      // Content mention scanning - check if article mentions any org names
      if (orgs?.length) {
        const textToSearch = `${article.title} ${article.body || ''}`.toLowerCase();
        for (const org of orgs) {
          if (org.name && org.name.length >= 3 && textToSearch.includes(org.name.toLowerCase())) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any).from('news_article_entities').upsert(
              { article_id: articleId, organization_id: org.id, match_type: 'content_mention' },
              { onConflict: 'article_id,organization_id' }
            ).then(({ error }: { error: any }) => {
              if (error) console.warn('[News] Content mention link error:', error.message);
            });
          }
        }
      }

      // Emit automation event for new articles
      const event: AutomationEvent = {
        projectId,
        triggerType: 'news.article_found' as AutomationEvent['triggerType'],
        entityType: 'organization',
        entityId: articleId,
        data: {
          article_title: article.title,
          article_url: article.url,
          matched_keywords: matchedKeywords,
          source_name: article.source?.title || null,
        },
      };
      emitAutomationEvent(event);
    }
  } catch (e) {
    const message = e instanceof NewsApiError
      ? `NewsAPI error: ${e.message}`
      : e instanceof Error
        ? e.message
        : 'Unknown fetch error';
    result.errors.push(message);

    // Log failed fetch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('news_fetch_log').insert({
      project_id: projectId,
      tokens_used: 1,
      articles_fetched: 0,
      keywords_searched: keywords,
      error_message: message,
    });
  }

  result.tokensRemaining = TOKEN_LIMIT - tokensUsed - result.tokensUsed;
  return result;
}

/**
 * Fetch news for all projects (used by cron)
 */
export async function fetchNewsForAllProjects(): Promise<{
  projectsProcessed: number;
  totalArticles: number;
  totalTokensUsed: number;
  tokensRemaining: number;
  errors: string[];
}> {
  const supabase = createAdminClient();
  const summary = {
    projectsProcessed: 0,
    totalArticles: 0,
    totalTokensUsed: 0,
    tokensRemaining: 0,
    errors: [] as string[],
  };

  // Check if we have budget
  const { allowed, tokensUsed } = await canFetch();
  summary.tokensRemaining = TOKEN_LIMIT - tokensUsed;

  if (!allowed) {
    summary.errors.push('Token limit reached, skipping all fetches');
    return summary;
  }

  // Get distinct projects with active keywords
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: projectRows, error } = await (supabase as any)
    .from('news_keywords')
    .select('project_id')
    .eq('is_active', true);

  if (error || !projectRows?.length) {
    return summary;
  }

  const projectIds = [...new Set(projectRows.map((r: any) => r.project_id))] as string[];

  for (const projectId of projectIds) {
    // Re-check token budget before each project
    const check = await canFetch();
    if (!check.allowed) {
      summary.errors.push(`Token limit reached after ${summary.projectsProcessed} projects`);
      break;
    }

    try {
      const result = await fetchNewsForProject(projectId);
      summary.projectsProcessed++;
      summary.totalArticles += result.articlesProcessed;
      summary.totalTokensUsed += result.tokensUsed;
      summary.tokensRemaining = result.tokensRemaining;
      summary.errors.push(...result.errors);
    } catch (e) {
      summary.errors.push(
        `Project ${projectId}: ${e instanceof Error ? e.message : 'Unknown error'}`
      );
    }
  }

  return summary;
}

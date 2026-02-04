import { newsApiResponseSchema, NewsApiError } from './types';
import type { NewsApiResponse } from './types';

const BASE_URL = 'https://eventregistry.org/api/v1/article/getArticles';

export class NewsApiClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.NEWS_API_KEY || '';
    if (!this.apiKey) {
      throw new NewsApiError('NEWS_API_KEY not configured');
    }
  }

  async searchArticles(params: {
    keywords: string[];
    keywordOper?: 'or' | 'and';
    lang?: string;
    dateStart?: string;
    dateEnd?: string;
    sortBy?: 'date' | 'rel' | 'socialScore';
    count?: number;
    page?: number;
  }): Promise<NewsApiResponse> {
    const body = {
      action: 'getArticles',
      keyword: params.keywords,
      keywordOper: params.keywordOper || 'or',
      lang: params.lang || 'eng',
      articlesSortBy: params.sortBy || 'date',
      articlesCount: params.count || 100,
      articlesPage: params.page || 1,
      resultType: 'articles',
      apiKey: this.apiKey,
      ...(params.dateStart && { dateStart: params.dateStart }),
      ...(params.dateEnd && { dateEnd: params.dateEnd }),
    };

    console.log('[NewsAPI] Sending request with keywords:', params.keywords, 'dateRange:', params.dateStart, '-', params.dateEnd);

    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown error');
      console.error('[NewsAPI] HTTP error:', response.status, text);
      throw new NewsApiError(
        `NewsAPI.ai request failed: ${response.status}`,
        response.status,
        text
      );
    }

    const data = await response.json();

    console.log('[NewsAPI] Response keys:', Object.keys(data));
    console.log('[NewsAPI] Articles count:', data.articles?.results?.length ?? 'no results key');

    // Check for API-level errors (token limit exceeded, etc.)
    if (data.error) {
      console.error('[NewsAPI] API error:', data.error);
      throw new NewsApiError(
        typeof data.error === 'string' ? data.error : data.error?.message || 'NewsAPI.ai API error',
        undefined,
        data
      );
    }

    // Handle case where API returns articles at top level or nested differently
    if (!data.articles && data.results) {
      data.articles = { results: data.results, totalResults: data.results.length, page: 1, count: data.results.length, pages: 1 };
    }

    const parsed = newsApiResponseSchema.safeParse(data);
    if (!parsed.success) {
      console.error('[NewsAPI] Response validation failed:', parsed.error.message);
      console.error('[NewsAPI] Raw response structure:', JSON.stringify(data).slice(0, 500));
      // Still try to use the data if it has articles
      if (data.articles?.results) {
        return data as NewsApiResponse;
      }
      throw new NewsApiError(`Invalid response from NewsAPI.ai: ${parsed.error.message}`);
    }

    console.log('[NewsAPI] Successfully parsed', parsed.data.articles.results.length, 'articles');
    return parsed.data;
  }
}

let instance: NewsApiClient | null = null;

export function getNewsApiClient(): NewsApiClient {
  if (!instance) {
    instance = new NewsApiClient();
  }
  return instance;
}

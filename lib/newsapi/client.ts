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

    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown error');
      throw new NewsApiError(
        `NewsAPI.ai request failed: ${response.status}`,
        response.status,
        text
      );
    }

    const data = await response.json();

    // Check for API-level errors (token limit exceeded, etc.)
    if (data.error) {
      throw new NewsApiError(
        data.error?.message || data.error || 'NewsAPI.ai API error',
        undefined,
        data
      );
    }

    const parsed = newsApiResponseSchema.safeParse(data);
    if (!parsed.success) {
      console.error('[NewsAPI] Response validation failed:', parsed.error.message);
      // Still try to use the data if it has articles
      if (data.articles?.results) {
        return data as NewsApiResponse;
      }
      throw new NewsApiError('Invalid response from NewsAPI.ai');
    }

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

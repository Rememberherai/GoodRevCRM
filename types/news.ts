// News feed types

export interface NewsKeyword {
  id: string;
  project_id: string;
  keyword: string;
  source: 'manual' | 'organization';
  organization_id: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface NewsArticle {
  id: string;
  project_id: string;
  title: string;
  body: string | null;
  description: string | null;
  source_name: string | null;
  author: string | null;
  url: string;
  image_url: string | null;
  published_at: string | null;
  matched_keywords: string[];
  sentiment: number | null;
  is_read: boolean;
  is_starred: boolean;
  fetched_at: string;
  created_at: string;
  // Joined data
  linked_organizations?: Array<{
    id: string;
    name: string;
  }>;
}

export interface NewsArticleEntity {
  id: string;
  article_id: string;
  organization_id: string;
  match_type: 'keyword' | 'content_mention';
  created_at: string;
}

export interface NewsFetchLog {
  id: string;
  project_id: string;
  tokens_used: number;
  articles_fetched: number;
  keywords_searched: string[];
  error_message: string | null;
  fetched_at: string;
}

export interface NewsTokenUsage {
  total_tokens_used: number;
  token_limit: number;
  tokens_remaining: number;
}

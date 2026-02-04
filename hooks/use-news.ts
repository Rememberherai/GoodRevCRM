'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { NewsArticle } from '@/types/news';

interface UseNewsOptions {
  projectSlug: string;
  keyword?: string;
  starred?: boolean;
  search?: string;
  orgId?: string;
  limit?: number;
}

interface UseNewsReturn {
  articles: NewsArticle[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  total: number;
  toggleStar: (articleId: string, isStarred: boolean) => Promise<void>;
  markAsRead: (articleId: string) => Promise<void>;
}

const DEFAULT_LIMIT = 20;

export function useNews(options: UseNewsOptions): UseNewsReturn {
  const {
    projectSlug,
    keyword,
    starred,
    search,
    orgId,
    limit = DEFAULT_LIMIT,
  } = options;

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const isLoadingMore = useRef(false);

  const buildUrl = useCallback(
    (currentPage: number) => {
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('limit', String(limit));
      if (keyword) params.set('keyword', keyword);
      if (starred) params.set('starred', 'true');
      if (search) params.set('search', search);
      if (orgId) params.set('org_id', orgId);
      return `/api/projects/${projectSlug}/news/articles?${params.toString()}`;
    },
    [projectSlug, keyword, starred, search, orgId, limit]
  );

  const loadArticles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(buildUrl(1));
      if (!response.ok) throw new Error('Failed to fetch articles');
      const data = await response.json();
      setArticles(data.articles || []);
      setTotal(data.pagination?.total || 0);
      setHasMore((data.pagination?.page || 1) < (data.pagination?.totalPages || 1));
      setPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [buildUrl]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore.current || !hasMore) return;
    isLoadingMore.current = true;
    try {
      const nextPage = page + 1;
      const response = await fetch(buildUrl(nextPage));
      if (!response.ok) throw new Error('Failed to load more');
      const data = await response.json();
      setArticles(prev => [...prev, ...(data.articles || [])]);
      setHasMore(nextPage < (data.pagination?.totalPages || 1));
      setPage(nextPage);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      isLoadingMore.current = false;
    }
  }, [buildUrl, hasMore, page]);

  const toggleStar = useCallback(async (articleId: string, isStarred: boolean) => {
    try {
      const response = await fetch(`/api/projects/${projectSlug}/news/articles/${articleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_starred: !isStarred }),
      });
      if (!response.ok) throw new Error('Failed to update');
      setArticles(prev =>
        prev.map(a => a.id === articleId ? { ...a, is_starred: !isStarred } : a)
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  }, [projectSlug]);

  const markAsRead = useCallback(async (articleId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectSlug}/news/articles/${articleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true }),
      });
      if (!response.ok) throw new Error('Failed to update');
      setArticles(prev =>
        prev.map(a => a.id === articleId ? { ...a, is_read: true } : a)
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  }, [projectSlug]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  return {
    articles,
    isLoading,
    error,
    refresh: loadArticles,
    loadMore,
    hasMore,
    total,
    toggleStar,
    markAsRead,
  };
}

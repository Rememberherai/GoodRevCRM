'use client';

import { useState, useCallback, useEffect } from 'react';
import type { NewsKeyword, NewsTokenUsage } from '@/types/news';

interface UseNewsKeywordsOptions {
  projectSlug: string;
}

interface UseNewsKeywordsReturn {
  keywords: NewsKeyword[];
  isLoading: boolean;
  error: string | null;
  tokenUsage: NewsTokenUsage | null;
  addKeyword: (keyword: string) => Promise<boolean>;
  removeKeyword: (id: string) => Promise<void>;
  toggleKeyword: (id: string, isActive: boolean) => Promise<void>;
  refresh: () => Promise<void>;
  fetchNews: () => Promise<{ fetched: number; tokensRemaining: number } | null>;
  isFetching: boolean;
}

export function useNewsKeywords(options: UseNewsKeywordsOptions): UseNewsKeywordsReturn {
  const { projectSlug } = options;

  const [keywords, setKeywords] = useState<NewsKeyword[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenUsage, setTokenUsage] = useState<NewsTokenUsage | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const loadKeywords = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [kwResponse, tokenResponse] = await Promise.all([
        fetch(`/api/projects/${projectSlug}/news/keywords`),
        fetch(`/api/projects/${projectSlug}/news/token-usage`),
      ]);

      if (kwResponse.ok) {
        const data = await kwResponse.json();
        setKeywords(data.keywords || []);
      }

      if (tokenResponse.ok) {
        const data = await tokenResponse.json();
        setTokenUsage(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [projectSlug]);

  const addKeyword = useCallback(async (keyword: string): Promise<boolean> => {
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/news/keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to add keyword');
        return false;
      }

      const data = await response.json();
      setKeywords(prev => [data.keyword, ...prev]);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      return false;
    }
  }, [projectSlug]);

  const removeKeyword = useCallback(async (id: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/news/keywords/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to remove keyword');
        return;
      }
      setKeywords(prev => prev.filter(k => k.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  }, [projectSlug]);

  const toggleKeyword = useCallback(async (id: string, isActive: boolean) => {
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/news/keywords/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive }),
      });
      if (!response.ok) throw new Error('Failed to update');
      setKeywords(prev =>
        prev.map(k => k.id === id ? { ...k, is_active: !isActive } : k)
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  }, [projectSlug]);

  const fetchNews = useCallback(async () => {
    setIsFetching(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/news/fetch`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to fetch news');
        return null;
      }
      // Refresh token usage
      const tokenResponse = await fetch(`/api/projects/${projectSlug}/news/token-usage`);
      if (tokenResponse.ok) {
        setTokenUsage(await tokenResponse.json());
      }
      return { fetched: data.fetched, tokensRemaining: data.tokensRemaining };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      return null;
    } finally {
      setIsFetching(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    loadKeywords();
  }, [loadKeywords]);

  return {
    keywords,
    isLoading,
    error,
    tokenUsage,
    addKeyword,
    removeKeyword,
    toggleKeyword,
    refresh: loadKeywords,
    fetchNews,
    isFetching,
  };
}

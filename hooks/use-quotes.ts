'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { Quote, QuoteWithLineItems, QuoteLineItem } from '@/types/quote';

export function useQuotes(opportunityId: string) {
  const params = useParams();
  const slug = params.slug as string;
  const oppId = params.id as string || opportunityId;
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const basePath = `/api/projects/${slug}/opportunities/${oppId}/quotes`;

  const loadQuotes = useCallback(async () => {
    if (!slug || !oppId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(basePath);
      if (!res.ok) throw new Error('Failed to fetch quotes');
      const data = await res.json();
      setQuotes(data.quotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [slug, oppId, basePath]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  const getQuote = useCallback(async (quoteId: string): Promise<QuoteWithLineItems> => {
    const res = await fetch(`${basePath}/${quoteId}`);
    if (!res.ok) throw new Error('Failed to fetch quote');
    const data = await res.json();
    return data.quote;
  }, [basePath]);

  const create = useCallback(async (input: Record<string, unknown>) => {
    const res = await fetch(basePath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to create quote');
    }
    const data = await res.json();
    await loadQuotes();
    return data.quote as Quote;
  }, [basePath, loadQuotes]);

  const update = useCallback(async (quoteId: string, input: Record<string, unknown>) => {
    const res = await fetch(`${basePath}/${quoteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to update quote');
    }
    const data = await res.json();
    setQuotes((prev) => prev.map((q) => (q.id === quoteId ? data.quote : q)));
    return data.quote as Quote;
  }, [basePath]);

  const remove = useCallback(async (quoteId: string) => {
    const res = await fetch(`${basePath}/${quoteId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete quote');
    setQuotes((prev) => prev.filter((q) => q.id !== quoteId));
  }, [basePath]);

  const accept = useCallback(async (quoteId: string, syncAmount = false) => {
    const res = await fetch(`${basePath}/${quoteId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sync_amount: syncAmount }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to accept quote');
    }
    await loadQuotes();
    return res.json();
  }, [basePath, loadQuotes]);

  const reject = useCallback(async (quoteId: string) => {
    const res = await fetch(`${basePath}/${quoteId}/reject`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to reject quote');
    }
    await loadQuotes();
  }, [basePath, loadQuotes]);

  const setPrimary = useCallback(async (quoteId: string) => {
    const res = await fetch(`${basePath}/${quoteId}/set-primary`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to set primary quote');
    }
    await loadQuotes();
  }, [basePath, loadQuotes]);

  // Line item operations
  const addLineItem = useCallback(async (quoteId: string, input: Record<string, unknown>) => {
    const res = await fetch(`${basePath}/${quoteId}/line-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to add line item');
    }
    const data = await res.json();
    return data.result as QuoteLineItem;
  }, [basePath]);

  const updateLineItem = useCallback(async (quoteId: string, itemId: string, input: Record<string, unknown>) => {
    const res = await fetch(`${basePath}/${quoteId}/line-items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to update line item');
    }
    const data = await res.json();
    return data.result as QuoteLineItem;
  }, [basePath]);

  const deleteLineItem = useCallback(async (quoteId: string, itemId: string) => {
    const res = await fetch(`${basePath}/${quoteId}/line-items/${itemId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete line item');
  }, [basePath]);

  const bulkReplaceLineItems = useCallback(async (quoteId: string, items: Record<string, unknown>[]) => {
    const res = await fetch(`${basePath}/${quoteId}/line-items`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to replace line items');
    }
    const data = await res.json();
    return data.result as QuoteWithLineItems;
  }, [basePath]);

  return {
    quotes,
    isLoading,
    error,
    getQuote,
    create,
    update,
    remove,
    accept,
    reject,
    setPrimary,
    addLineItem,
    updateLineItem,
    deleteLineItem,
    bulkReplaceLineItems,
    reload: loadQuotes,
  };
}

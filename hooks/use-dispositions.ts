'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { DispositionRow, DispositionEntityType } from '@/types/disposition';

export function useDispositions(entityType: DispositionEntityType) {
  const params = useParams();
  const slug = params.slug as string;
  const [dispositions, setDispositions] = useState<DispositionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/dispositions?entity_type=${entityType}`);
      if (!res.ok) throw new Error('Failed to fetch dispositions');
      const data = await res.json();
      setDispositions(data.dispositions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [slug, entityType]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(async (input: Record<string, unknown>) => {
    const res = await fetch(`/api/projects/${slug}/dispositions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, entity_type: entityType }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to create disposition');
    }
    const data = await res.json();
    await load();
    return data.disposition as DispositionRow;
  }, [slug, entityType, load]);

  const update = useCallback(async (id: string, input: Record<string, unknown>) => {
    const res = await fetch(`/api/projects/${slug}/dispositions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to update disposition');
    }
    const data = await res.json();
    await load();
    return data.disposition as DispositionRow;
  }, [slug, load]);

  const remove = useCallback(async (id: string) => {
    const res = await fetch(`/api/projects/${slug}/dispositions/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete disposition');
    await load();
  }, [slug, load]);

  const reorder = useCallback(async (items: Array<{ id: string; sort_order: number }>) => {
    const res = await fetch(`/api/projects/${slug}/dispositions/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) throw new Error('Failed to reorder dispositions');
    await load();
  }, [slug, load]);

  return {
    dispositions,
    isLoading,
    error,
    create,
    update,
    remove,
    reorder,
    reload: load,
  };
}

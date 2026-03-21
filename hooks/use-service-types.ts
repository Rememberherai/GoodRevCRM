'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { ServiceTypeRow } from '@/types/service-type';

export function useServiceTypes() {
  const params = useParams();
  const slug = params.slug as string;
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/service-types`);
      if (!res.ok) throw new Error('Failed to fetch service types');
      const data = await res.json();
      setServiceTypes(data.serviceTypes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(async (input: Record<string, unknown>) => {
    const res = await fetch(`/api/projects/${slug}/service-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to create service type');
    }
    const data = await res.json();
    await load();
    return data.serviceType as ServiceTypeRow;
  }, [slug, load]);

  const update = useCallback(async (id: string, input: Record<string, unknown>) => {
    const res = await fetch(`/api/projects/${slug}/service-types/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to update service type');
    }
    const data = await res.json();
    await load();
    return data.serviceType as ServiceTypeRow;
  }, [slug, load]);

  const remove = useCallback(async (id: string) => {
    const res = await fetch(`/api/projects/${slug}/service-types/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete service type');
    await load();
  }, [slug, load]);

  const reorder = useCallback(async (items: Array<{ id: string; sort_order: number }>) => {
    const res = await fetch(`/api/projects/${slug}/service-types/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) throw new Error('Failed to reorder service types');
    await load();
  }, [slug, load]);

  return {
    serviceTypes,
    isLoading,
    error,
    create,
    update,
    remove,
    reorder,
    reload: load,
  };
}

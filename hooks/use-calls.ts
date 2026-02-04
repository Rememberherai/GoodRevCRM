import { useState, useEffect, useCallback } from 'react';
import type { CallWithRelations, CallMetrics } from '@/types/call';

// Hook for fetching paginated call list
export function useCalls(params: {
  projectSlug: string;
  personId?: string;
  organizationId?: string;
  opportunityId?: string;
  userId?: string;
  direction?: string;
  disposition?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  const [calls, setCalls] = useState<CallWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = params.limit ?? 20;

  const fetchCalls = useCallback(
    async (currentOffset: number, append = false) => {
      setIsLoading(true);
      try {
        const searchParams = new URLSearchParams();
        searchParams.set('limit', String(limit));
        searchParams.set('offset', String(currentOffset));
        if (params.personId) searchParams.set('person_id', params.personId);
        if (params.organizationId) searchParams.set('organization_id', params.organizationId);
        if (params.opportunityId) searchParams.set('opportunity_id', params.opportunityId);
        if (params.userId) searchParams.set('user_id', params.userId);
        if (params.direction) searchParams.set('direction', params.direction);
        if (params.disposition) searchParams.set('disposition', params.disposition);
        if (params.startDate) searchParams.set('start_date', params.startDate);
        if (params.endDate) searchParams.set('end_date', params.endDate);

        const res = await fetch(
          `/api/projects/${params.projectSlug}/calls?${searchParams.toString()}`
        );
        if (!res.ok) return;

        const data = await res.json();
        const newCalls = data.calls ?? [];

        setCalls((prev) => (append ? [...prev, ...newCalls] : newCalls));
        setHasMore(newCalls.length === limit);
      } catch (err) {
        console.error('Error fetching calls:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [
      params.projectSlug, params.personId, params.organizationId,
      params.opportunityId, params.userId, params.direction,
      params.disposition, params.startDate, params.endDate, limit,
    ]
  );

  useEffect(() => {
    setOffset(0);
    fetchCalls(0);
  }, [fetchCalls]);

  const loadMore = useCallback(() => {
    const newOffset = offset + limit;
    setOffset(newOffset);
    fetchCalls(newOffset, true);
  }, [offset, limit, fetchCalls]);

  const refresh = useCallback(() => {
    setOffset(0);
    fetchCalls(0);
  }, [fetchCalls]);

  return { calls, isLoading, hasMore, loadMore, refresh };
}

// Hook for fetching call metrics
export function useCallMetrics(params: {
  projectSlug: string;
  startDate: string;
  endDate: string;
  userId?: string;
}) {
  const [metrics, setMetrics] = useState<CallMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    setIsLoading(true);
    try {
      const searchParams = new URLSearchParams({
        start_date: params.startDate,
        end_date: params.endDate,
      });
      if (params.userId) searchParams.set('user_id', params.userId);

      const res = await fetch(
        `/api/projects/${params.projectSlug}/calls/metrics?${searchParams.toString()}`
      );
      if (!res.ok) return;

      const data = await res.json();
      setMetrics(data.metrics);
    } catch (err) {
      console.error('Error fetching call metrics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [params.projectSlug, params.startDate, params.endDate, params.userId]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return { metrics, isLoading, refresh: fetchMetrics };
}

// Hook for Telnyx connection status
export function useTelnyxConnection(projectSlug: string) {
  const [connection, setConnection] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConnection = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/telnyx`);
      if (!res.ok) {
        setConnection(null);
        return;
      }
      const data = await res.json();
      setConnection(data.connection);
    } catch {
      setConnection(null);
    } finally {
      setIsLoading(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    fetchConnection();
  }, [fetchConnection]);

  return { connection, isLoading, refresh: fetchConnection };
}

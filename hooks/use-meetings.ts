'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { MeetingWithRelations } from '@/types/meeting';

interface UseMeetingsOptions {
  projectSlug: string;
  personId?: string;
  organizationId?: string;
  opportunityId?: string;
  rfpId?: string;
  status?: string;
  scheduledAfter?: string;
  scheduledBefore?: string;
  limit?: number;
}

interface UseMeetingsReturn {
  meetings: MeetingWithRelations[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

const DEFAULT_LIMIT = 20;

export function useMeetings(options: UseMeetingsOptions): UseMeetingsReturn {
  const {
    projectSlug,
    personId,
    organizationId,
    opportunityId,
    rfpId,
    status,
    scheduledAfter,
    scheduledBefore,
    limit = DEFAULT_LIMIT,
  } = options;

  const [meetings, setMeetings] = useState<MeetingWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const isLoadingMore = useRef(false);

  const buildQueryParams = useCallback(
    (currentOffset: number) => {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(currentOffset));
      if (personId) params.set('personId', personId);
      if (organizationId) params.set('organizationId', organizationId);
      if (opportunityId) params.set('opportunityId', opportunityId);
      if (rfpId) params.set('rfpId', rfpId);
      if (status) params.set('status', status);
      if (scheduledAfter) params.set('scheduledAfter', scheduledAfter);
      if (scheduledBefore) params.set('scheduledBefore', scheduledBefore);
      return params.toString();
    },
    [limit, personId, organizationId, opportunityId, rfpId, status, scheduledAfter, scheduledBefore]
  );

  const loadMeetings = useCallback(async () => {
    if (!projectSlug) return;

    setIsLoading(true);
    setError(null);
    try {
      const query = buildQueryParams(0);
      const response = await fetch(
        `/api/projects/${projectSlug}/meetings?${query}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch meetings');
      }
      const data = await response.json();
      const items: MeetingWithRelations[] = data.data ?? data.meetings ?? data ?? [];
      setMeetings(items);
      setOffset(items.length);
      setHasMore(items.length === limit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch meetings');
    } finally {
      setIsLoading(false);
    }
  }, [projectSlug, buildQueryParams, limit]);

  const loadMore = useCallback(async () => {
    if (!projectSlug || isLoadingMore.current || !hasMore) return;

    isLoadingMore.current = true;
    setError(null);
    try {
      const query = buildQueryParams(offset);
      const response = await fetch(
        `/api/projects/${projectSlug}/meetings?${query}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch more meetings');
      }
      const data = await response.json();
      const items: MeetingWithRelations[] = data.data ?? data.meetings ?? data ?? [];
      setMeetings((prev) => [...prev, ...items]);
      setOffset((prev) => prev + items.length);
      setHasMore(items.length === limit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch more meetings');
    } finally {
      isLoadingMore.current = false;
    }
  }, [projectSlug, buildQueryParams, offset, hasMore, limit]);

  const refresh = useCallback(async () => {
    setOffset(0);
    await loadMeetings();
  }, [loadMeetings]);

  // Load meetings on mount and when dependencies change
  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  return {
    meetings,
    isLoading,
    error,
    refresh,
    loadMore,
    hasMore,
  };
}

export function useUpdateMeetingStatus(projectSlug: string) {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateStatus = useCallback(async (meetingId: string, data: {
    status: string;
    outcome?: string | null;
    outcome_notes?: string | null;
    next_steps?: string | null;
    new_scheduled_at?: string | null;
    cancellation_reason?: string | null;
  }) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/meetings/${meetingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update meeting status');
      return await response.json();
    } finally {
      setIsUpdating(false);
    }
  }, [projectSlug]);

  return { updateStatus, isUpdating };
}

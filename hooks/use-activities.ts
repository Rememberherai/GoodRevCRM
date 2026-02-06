'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ActivityWithUser } from '@/types/activity';
import { onDispositionSaved } from '@/stores/call';

interface UseActivitiesOptions {
  projectSlug: string;
  personId?: string;
  organizationId?: string;
  opportunityId?: string;
  rfpId?: string;
  activityType?: string;
  limit?: number;
}

interface UseActivitiesReturn {
  activities: ActivityWithUser[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

const DEFAULT_LIMIT = 20;

export function useActivities(options: UseActivitiesOptions): UseActivitiesReturn {
  const {
    projectSlug,
    personId,
    organizationId,
    opportunityId,
    rfpId,
    activityType,
    limit = DEFAULT_LIMIT,
  } = options;

  const [activities, setActivities] = useState<ActivityWithUser[]>([]);
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
      if (personId) params.set('person_id', personId);
      if (organizationId) params.set('organization_id', organizationId);
      if (opportunityId) params.set('opportunity_id', opportunityId);
      if (rfpId) params.set('rfp_id', rfpId);
      if (activityType) params.set('activity_type', activityType);
      return params.toString();
    },
    [limit, personId, organizationId, opportunityId, rfpId, activityType]
  );

  const loadActivities = useCallback(async () => {
    if (!projectSlug) return;

    setIsLoading(true);
    setError(null);
    try {
      const query = buildQueryParams(0);
      const response = await fetch(
        `/api/projects/${projectSlug}/activity?${query}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch activities');
      }
      const data = await response.json();
      const items: ActivityWithUser[] = data.data ?? data.activities ?? data ?? [];
      setActivities(items);
      setOffset(items.length);
      setHasMore(items.length === limit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch activities');
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
        `/api/projects/${projectSlug}/activity?${query}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch more activities');
      }
      const data = await response.json();
      const items: ActivityWithUser[] = data.data ?? data.activities ?? data ?? [];
      setActivities((prev) => [...prev, ...items]);
      setOffset((prev) => prev + items.length);
      setHasMore(items.length === limit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch more activities');
    } finally {
      isLoadingMore.current = false;
    }
  }, [projectSlug, buildQueryParams, offset, hasMore, limit]);

  const refresh = useCallback(async () => {
    setOffset(0);
    await loadActivities();
  }, [loadActivities]);

  // Load activities on mount and when dependencies change
  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // Subscribe to disposition saved events to auto-refresh
  useEffect(() => {
    const unsubscribe = onDispositionSaved((savedPersonId) => {
      // Refresh if this hook is watching the person whose call just ended
      if (personId && savedPersonId === personId) {
        loadActivities();
      }
    });
    return () => { unsubscribe(); };
  }, [personId, loadActivities]);

  return {
    activities,
    isLoading,
    error,
    refresh,
    loadMore,
    hasMore,
  };
}

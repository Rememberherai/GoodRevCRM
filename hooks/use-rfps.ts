'use client';

import { useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  useRfpStore,
  fetchRfps,
  fetchRfp,
  createRfp,
  updateRfpApi,
  deleteRfp,
} from '@/stores/rfp';
import type { CreateRfpInput, UpdateRfpInput } from '@/lib/validators/rfp';
import type { RfpStatus } from '@/types/rfp';

export function useRfps() {
  const params = useParams();
  const projectSlug = params.slug as string;

  const {
    rfps,
    pagination,
    isLoading,
    error,
    searchQuery,
    sortBy,
    sortOrder,
    statusFilter,
    organizationFilter,
    setRfps,
    addRfp,
    updateRfp,
    removeRfp,
    setLoading,
    setError,
    setSearchQuery,
    setSorting,
    setStatusFilter,
    setOrganizationFilter,
    setPage,
  } = useRfpStore();

  const loadRfps = useCallback(async () => {
    if (!projectSlug) return;

    setLoading(true);
    try {
      const result = await fetchRfps(projectSlug, {
        page: pagination.page,
        limit: pagination.limit,
        search: searchQuery,
        sortBy,
        sortOrder,
        status: statusFilter ?? undefined,
        organizationId: organizationFilter ?? undefined,
      });
      setRfps(result.rfps, result.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch RFPs');
    }
  }, [
    projectSlug,
    pagination.page,
    pagination.limit,
    searchQuery,
    sortBy,
    sortOrder,
    statusFilter,
    organizationFilter,
    setRfps,
    setLoading,
    setError,
  ]);

  const create = useCallback(
    async (data: CreateRfpInput) => {
      if (!projectSlug) throw new Error('No project selected');

      setLoading(true);
      try {
        const rfp = await createRfp(projectSlug, data);
        addRfp(rfp);
        return rfp;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create RFP';
        setError(message);
        throw err;
      }
    },
    [projectSlug, addRfp, setLoading, setError]
  );

  const update = useCallback(
    async (id: string, data: UpdateRfpInput) => {
      if (!projectSlug) throw new Error('No project selected');

      setLoading(true);
      try {
        const rfp = await updateRfpApi(projectSlug, id, data);
        updateRfp(id, rfp);
        return rfp;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update RFP';
        setError(message);
        throw err;
      }
    },
    [projectSlug, updateRfp, setLoading, setError]
  );

  const remove = useCallback(
    async (id: string) => {
      if (!projectSlug) throw new Error('No project selected');

      setLoading(true);
      try {
        await deleteRfp(projectSlug, id);
        removeRfp(id);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete RFP';
        setError(message);
        throw err;
      }
    },
    [projectSlug, removeRfp, setLoading, setError]
  );

  const search = useCallback(
    (query: string) => {
      setSearchQuery(query);
    },
    [setSearchQuery]
  );

  const sort = useCallback(
    (field: string, order: 'asc' | 'desc') => {
      setSorting(field, order);
    },
    [setSorting]
  );

  const filterByStatus = useCallback(
    (status: RfpStatus | null) => {
      setStatusFilter(status);
    },
    [setStatusFilter]
  );

  const filterByOrganization = useCallback(
    (organizationId: string | null) => {
      setOrganizationFilter(organizationId);
    },
    [setOrganizationFilter]
  );

  const goToPage = useCallback(
    (page: number) => {
      setPage(page);
    },
    [setPage]
  );

  // Load RFPs when dependencies change
  useEffect(() => {
    loadRfps();
  }, [loadRfps]);

  return {
    rfps,
    pagination,
    isLoading,
    error,
    searchQuery,
    sortBy,
    sortOrder,
    statusFilter,
    organizationFilter,
    refresh: loadRfps,
    create,
    update,
    remove,
    search,
    sort,
    filterByStatus,
    filterByOrganization,
    goToPage,
  };
}

export function useRfp(rfpId: string) {
  const params = useParams();
  const projectSlug = params.slug as string;

  const {
    currentRfp,
    isLoading,
    error,
    setCurrentRfp,
    setLoading,
    setError,
  } = useRfpStore();

  const loadRfp = useCallback(async () => {
    if (!projectSlug || !rfpId) return;

    setLoading(true);
    try {
      const rfp = await fetchRfp(projectSlug, rfpId);
      setCurrentRfp(rfp);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch RFP');
    }
  }, [projectSlug, rfpId, setCurrentRfp, setLoading, setError]);

  const update = useCallback(
    async (data: UpdateRfpInput) => {
      if (!projectSlug || !rfpId) throw new Error('Invalid parameters');

      setLoading(true);
      try {
        const rfp = await updateRfpApi(projectSlug, rfpId, data);
        setCurrentRfp({ ...rfp, organization: null, opportunity: null });
        return rfp;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update RFP';
        setError(message);
        throw err;
      }
    },
    [projectSlug, rfpId, setCurrentRfp, setLoading, setError]
  );

  useEffect(() => {
    loadRfp();
  }, [loadRfp]);

  return {
    rfp: currentRfp,
    isLoading,
    error,
    refresh: loadRfp,
    update,
  };
}

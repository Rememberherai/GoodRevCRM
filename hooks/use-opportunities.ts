'use client';

import { useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  useOpportunityStore,
  fetchOpportunities,
  fetchOpportunity,
  createOpportunity,
  updateOpportunityApi,
  deleteOpportunity,
} from '@/stores/opportunity';
import type { CreateOpportunityInput, UpdateOpportunityInput } from '@/lib/validators/opportunity';
import type { OpportunityStage } from '@/types/opportunity';

export function useOpportunities() {
  const params = useParams();
  const projectSlug = params.slug as string;

  const {
    opportunities,
    pagination,
    isLoading,
    error,
    searchQuery,
    sortBy,
    sortOrder,
    stageFilter,
    organizationFilter,
    setOpportunities,
    addOpportunity,
    updateOpportunity,
    removeOpportunity,
    setLoading,
    setError,
    setSearchQuery,
    setSorting,
    setStageFilter,
    setOrganizationFilter,
    setPage,
  } = useOpportunityStore();

  const loadOpportunities = useCallback(async () => {
    if (!projectSlug) return;

    setLoading(true);
    try {
      const result = await fetchOpportunities(projectSlug, {
        page: pagination.page,
        limit: pagination.limit,
        search: searchQuery,
        sortBy,
        sortOrder,
        stage: stageFilter ?? undefined,
        organizationId: organizationFilter ?? undefined,
      });
      setOpportunities(result.opportunities, result.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch opportunities');
    }
  }, [
    projectSlug,
    pagination.page,
    pagination.limit,
    searchQuery,
    sortBy,
    sortOrder,
    stageFilter,
    organizationFilter,
    setOpportunities,
    setLoading,
    setError,
  ]);

  const create = useCallback(
    async (data: CreateOpportunityInput) => {
      if (!projectSlug) throw new Error('No project selected');

      setLoading(true);
      try {
        const opportunity = await createOpportunity(projectSlug, data);
        addOpportunity(opportunity);
        return opportunity;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create opportunity';
        setError(message);
        throw err;
      }
    },
    [projectSlug, addOpportunity, setLoading, setError]
  );

  const update = useCallback(
    async (id: string, data: UpdateOpportunityInput) => {
      if (!projectSlug) throw new Error('No project selected');

      setLoading(true);
      try {
        const opportunity = await updateOpportunityApi(projectSlug, id, data);
        updateOpportunity(id, opportunity);
        return opportunity;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update opportunity';
        setError(message);
        throw err;
      }
    },
    [projectSlug, updateOpportunity, setLoading, setError]
  );

  const remove = useCallback(
    async (id: string) => {
      if (!projectSlug) throw new Error('No project selected');

      setLoading(true);
      try {
        await deleteOpportunity(projectSlug, id);
        removeOpportunity(id);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete opportunity';
        setError(message);
        throw err;
      }
    },
    [projectSlug, removeOpportunity, setLoading, setError]
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

  const filterByStage = useCallback(
    (stage: OpportunityStage | null) => {
      setStageFilter(stage);
    },
    [setStageFilter]
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

  // Load opportunities when dependencies change
  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  return {
    opportunities,
    pagination,
    isLoading,
    error,
    searchQuery,
    sortBy,
    sortOrder,
    stageFilter,
    organizationFilter,
    refresh: loadOpportunities,
    create,
    update,
    remove,
    search,
    sort,
    filterByStage,
    filterByOrganization,
    goToPage,
  };
}

export function useOpportunity(opportunityId: string) {
  const params = useParams();
  const projectSlug = params.slug as string;

  const {
    currentOpportunity,
    isLoading,
    error,
    setCurrentOpportunity,
    setLoading,
    setError,
  } = useOpportunityStore();

  const loadOpportunity = useCallback(async () => {
    if (!projectSlug || !opportunityId) return;

    setLoading(true);
    try {
      const opportunity = await fetchOpportunity(projectSlug, opportunityId);
      setCurrentOpportunity(opportunity);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch opportunity');
    }
  }, [projectSlug, opportunityId, setCurrentOpportunity, setLoading, setError]);

  const update = useCallback(
    async (data: UpdateOpportunityInput) => {
      if (!projectSlug || !opportunityId) throw new Error('Invalid parameters');

      setLoading(true);
      try {
        const opportunity = await updateOpportunityApi(projectSlug, opportunityId, data);
        setCurrentOpportunity({ ...opportunity, organization: null, primary_contact: null });
        return opportunity;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update opportunity';
        setError(message);
        throw err;
      }
    },
    [projectSlug, opportunityId, setCurrentOpportunity, setLoading, setError]
  );

  useEffect(() => {
    loadOpportunity();
  }, [loadOpportunity]);

  return {
    opportunity: currentOpportunity,
    isLoading,
    error,
    refresh: loadOpportunity,
    update,
  };
}

'use client';

import { useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  useOrganizationStore,
  fetchOrganizations,
  fetchOrganization,
  createOrganization,
  updateOrganizationApi,
  deleteOrganization,
} from '@/stores/organization';
import type { CreateOrganizationInput, UpdateOrganizationInput } from '@/lib/validators/organization';

export function useOrganizations() {
  const params = useParams();
  const projectSlug = params.slug as string;

  const {
    organizations,
    pagination,
    isLoading,
    error,
    searchQuery,
    sortBy,
    sortOrder,
    setOrganizations,
    addOrganization,
    updateOrganization,
    removeOrganization,
    setLoading,
    setError,
    setSearchQuery,
    setSorting,
    setPage,
  } = useOrganizationStore();

  const loadOrganizations = useCallback(async () => {
    if (!projectSlug) return;

    setLoading(true);
    try {
      const result = await fetchOrganizations(projectSlug, {
        page: pagination.page,
        limit: pagination.limit,
        search: searchQuery,
        sortBy,
        sortOrder,
      });
      setOrganizations(result.organizations, result.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch organizations');
    } finally {
      setLoading(false);
    }
  }, [
    projectSlug,
    pagination.page,
    pagination.limit,
    searchQuery,
    sortBy,
    sortOrder,
    setOrganizations,
    setLoading,
    setError,
  ]);

  const create = useCallback(
    async (data: CreateOrganizationInput) => {
      if (!projectSlug) throw new Error('No project selected');

      setLoading(true);
      try {
        const organization = await createOrganization(projectSlug, data);
        addOrganization(organization);
        return organization;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create organization';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [projectSlug, addOrganization, setLoading, setError]
  );

  const update = useCallback(
    async (id: string, data: UpdateOrganizationInput) => {
      if (!projectSlug) throw new Error('No project selected');

      setLoading(true);
      try {
        const organization = await updateOrganizationApi(projectSlug, id, data);
        updateOrganization(id, organization);
        return organization;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update organization';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [projectSlug, updateOrganization, setLoading, setError]
  );

  const remove = useCallback(
    async (id: string) => {
      if (!projectSlug) throw new Error('No project selected');

      setLoading(true);
      try {
        await deleteOrganization(projectSlug, id);
        removeOrganization(id);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete organization';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [projectSlug, removeOrganization, setLoading, setError]
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

  const goToPage = useCallback(
    (page: number) => {
      setPage(page);
    },
    [setPage]
  );

  // Load organizations when dependencies change
  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  return {
    organizations,
    pagination,
    isLoading,
    error,
    searchQuery,
    sortBy,
    sortOrder,
    refresh: loadOrganizations,
    create,
    update,
    remove,
    search,
    sort,
    goToPage,
  };
}

export function useOrganization(organizationId: string) {
  const params = useParams();
  const projectSlug = params.slug as string;

  const {
    currentOrganization,
    isLoading,
    error,
    setCurrentOrganization,
    setLoading,
    setError,
  } = useOrganizationStore();

  const loadOrganization = useCallback(async () => {
    if (!projectSlug || !organizationId) return;

    setLoading(true);
    try {
      const organization = await fetchOrganization(projectSlug, organizationId);
      setCurrentOrganization(organization);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch organization');
    } finally {
      setLoading(false);
    }
  }, [projectSlug, organizationId, setCurrentOrganization, setLoading, setError]);

  const update = useCallback(
    async (data: UpdateOrganizationInput) => {
      if (!projectSlug || !organizationId) throw new Error('Invalid parameters');

      setLoading(true);
      try {
        const organization = await updateOrganizationApi(projectSlug, organizationId, data);
        setCurrentOrganization({ ...organization, people_count: 0, opportunities_count: 0 });
        return organization;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update organization';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [projectSlug, organizationId, setCurrentOrganization, setLoading, setError]
  );

  useEffect(() => {
    loadOrganization();
  }, [loadOrganization]);

  return {
    organization: currentOrganization,
    isLoading,
    error,
    refresh: loadOrganization,
    update,
  };
}

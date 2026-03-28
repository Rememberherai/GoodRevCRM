'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  usePersonStore,
  fetchPeople,
  fetchPerson,
  createPerson,
  updatePersonApi,
  deletePerson,
} from '@/stores/person';
import type { CreatePersonInput, UpdatePersonInput } from '@/lib/validators/person';
import type { PersonWithRelations } from '@/types/person';

export function usePeople() {
  const params = useParams();
  const projectSlug = params.slug as string;

  const {
    people,
    pagination,
    isLoading,
    error,
    searchQuery,
    sortBy,
    sortOrder,
    organizationFilter,
    householdlessFilter,
    setPeople,
    addPerson,
    updatePerson,
    removePerson,
    setLoading,
    setError,
    setSearchQuery,
    setSorting,
    setOrganizationFilter,
    setHouseholdlessFilter,
    setPage,
  } = usePersonStore();

  const loadPeople = useCallback(async () => {
    if (!projectSlug) return;

    setLoading(true);
    try {
      const result = await fetchPeople(projectSlug, {
        page: pagination.page,
        limit: pagination.limit,
        search: searchQuery,
        sortBy,
        sortOrder,
        organizationId: organizationFilter ?? undefined,
        householdless: householdlessFilter,
      });
      setPeople(result.people, result.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch people');
    }
  }, [
    projectSlug,
    pagination.page,
    pagination.limit,
    searchQuery,
    sortBy,
    sortOrder,
    organizationFilter,
    householdlessFilter,
    setPeople,
    setLoading,
    setError,
  ]);

  const create = useCallback(
    async (data: CreatePersonInput & {
      organization_id?: string;
      force_create?: boolean;
      household_id?: string;
      household_relationship?: string;
      household_is_primary_contact?: boolean;
      new_household?: {
        name: string;
        address_street?: string;
        address_city?: string;
        address_state?: string;
        address_postal_code?: string;
      };
    }) => {
      if (!projectSlug) throw new Error('No project selected');

      setLoading(true);
      try {
        const person = await createPerson(projectSlug, data);
        addPerson(person);
        return person;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create person';
        setError(message);
        throw err;
      }
    },
    [projectSlug, addPerson, setLoading, setError]
  );

  const update = useCallback(
    async (id: string, data: UpdatePersonInput) => {
      if (!projectSlug) throw new Error('No project selected');

      setLoading(true);
      try {
        const person = await updatePersonApi(projectSlug, id, data);
        updatePerson(id, person);
        return person;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update person';
        setError(message);
        throw err;
      }
    },
    [projectSlug, updatePerson, setLoading, setError]
  );

  const remove = useCallback(
    async (id: string) => {
      if (!projectSlug) throw new Error('No project selected');

      setLoading(true);
      try {
        await deletePerson(projectSlug, id);
        removePerson(id);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete person';
        setError(message);
        throw err;
      }
    },
    [projectSlug, removePerson, setLoading, setError]
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

  const filterByOrganization = useCallback(
    (organizationId: string | null) => {
      setOrganizationFilter(organizationId);
    },
    [setOrganizationFilter]
  );

  const filterByHouseholdless = useCallback(
    (enabled: boolean) => {
      setHouseholdlessFilter(enabled);
    },
    [setHouseholdlessFilter]
  );

  const goToPage = useCallback(
    (page: number) => {
      setPage(page);
    },
    [setPage]
  );

  // Load people when dependencies change
  useEffect(() => {
    loadPeople();
  }, [loadPeople]);

  return {
    people,
    pagination,
    isLoading,
    error,
    searchQuery,
    sortBy,
    sortOrder,
    organizationFilter,
    householdlessFilter,
    refresh: loadPeople,
    create,
    update,
    remove,
    search,
    sort,
    filterByOrganization,
    filterByHouseholdless,
    goToPage,
  };
}

export function usePerson(personId: string) {
  const params = useParams();
  const projectSlug = params.slug as string;

  const setCurrentPerson = usePersonStore((state) => state.setCurrentPerson);
  const updatePersonInStore = usePersonStore((state) => state.updatePerson);
  const [person, setPerson] = useState<PersonWithRelations | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPerson = useCallback(async () => {
    if (!projectSlug || !personId) return;

    const isInitialLoad = !person || person.id !== personId;

    setIsLoading(true);
    setError(null);

    if (isInitialLoad) {
      setPerson(null);
      setCurrentPerson(null);
    }

    try {
      const nextPerson = await fetchPerson(projectSlug, personId);
      setPerson(nextPerson);
      setCurrentPerson(nextPerson);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch person';
      setError(message);
      if (isInitialLoad) {
        setPerson(null);
        setCurrentPerson(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectSlug, personId, person, setCurrentPerson]);

  const update = useCallback(
    async (data: UpdatePersonInput) => {
      if (!projectSlug || !personId) throw new Error('Invalid parameters');

      setIsLoading(true);
      setError(null);
      try {
        const updatedPerson = await updatePersonApi(projectSlug, personId, data);
        const nextPerson = person
          ? { ...person, ...updatedPerson }
          : { ...updatedPerson, organization_count: 0, opportunities_count: 0 };

        setPerson(nextPerson as PersonWithRelations);
        setCurrentPerson(nextPerson as PersonWithRelations);
        updatePersonInStore(personId, updatedPerson);

        return updatedPerson;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update person';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [projectSlug, personId, person, setCurrentPerson, updatePersonInStore]
  );

  useEffect(() => {
    void loadPerson();
  }, [loadPerson]);

  return {
    person,
    isLoading,
    error,
    refresh: loadPerson,
    update,
    setPerson,
  };
}

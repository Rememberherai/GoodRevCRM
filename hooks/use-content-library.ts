'use client';

import { useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  useContentLibraryStore,
  fetchContentLibrary,
  createContentLibraryEntryApi,
  bulkCreateContentLibraryApi,
  updateContentLibraryEntryApi,
  deleteContentLibraryEntryApi,
  searchContentLibraryApi,
} from '@/stores/rfp-content-library';
import type { CreateContentLibraryEntryInput, UpdateContentLibraryEntryInput } from '@/lib/validators/rfp-content-library';

export function useContentLibrary() {
  const params = useParams();
  const slug = params.slug as string;

  const {
    entries,
    totalCount,
    isLoading,
    error,
    categoryFilter,
    searchQuery,
    setEntries,
    addEntry,
    addEntries,
    updateEntry,
    removeEntry,
    setLoading,
    setError,
    setCategoryFilter,
    setSearchQuery,
  } = useContentLibraryStore();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchContentLibrary(slug, {
        category: categoryFilter ?? undefined,
        search: searchQuery || undefined,
      });
      setEntries(data.entries, data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content library');
    } finally {
      setLoading(false);
    }
  }, [slug, categoryFilter, searchQuery, setEntries, setLoading, setError]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (input: CreateContentLibraryEntryInput) => {
    try {
      const entry = await createContentLibraryEntryApi(slug, input);
      addEntry(entry);
      return entry;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create entry';
      setError(message);
      throw err;
    }
  };

  const bulkCreate = async (inputs: CreateContentLibraryEntryInput[]) => {
    try {
      const created = await bulkCreateContentLibraryApi(slug, inputs);
      addEntries(created);
      return created;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create entries';
      setError(message);
      throw err;
    }
  };

  const update = async (entryId: string, input: UpdateContentLibraryEntryInput) => {
    try {
      const updated = await updateContentLibraryEntryApi(slug, entryId, input);
      updateEntry(entryId, updated);
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update entry';
      setError(message);
      throw err;
    }
  };

  const remove = async (entryId: string) => {
    try {
      await deleteContentLibraryEntryApi(slug, entryId);
      removeEntry(entryId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete entry';
      setError(message);
      throw err;
    }
  };

  const search = async (query: string, options?: { category?: string; limit?: number }) => {
    return searchContentLibraryApi(slug, query, options);
  };

  const filterByCategory = (category: string | null) => {
    setCategoryFilter(category);
  };

  const setSearch = (query: string) => {
    setSearchQuery(query);
  };

  return {
    entries,
    totalCount,
    isLoading,
    error,
    categoryFilter,
    searchQuery,
    refresh: load,
    create,
    bulkCreate,
    update,
    remove,
    search,
    filterByCategory,
    setSearch,
  };
}

import { create } from 'zustand';
import type { ContentLibraryEntry } from '@/types/rfp-content-library';
import type { CreateContentLibraryEntryInput, UpdateContentLibraryEntryInput } from '@/lib/validators/rfp-content-library';

interface ContentLibraryState {
  entries: ContentLibraryEntry[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  categoryFilter: string | null;
  searchQuery: string;

  setEntries: (entries: ContentLibraryEntry[], totalCount: number) => void;
  addEntry: (entry: ContentLibraryEntry) => void;
  addEntries: (entries: ContentLibraryEntry[]) => void;
  updateEntry: (id: string, updates: Partial<ContentLibraryEntry>) => void;
  removeEntry: (id: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setCategoryFilter: (category: string | null) => void;
  setSearchQuery: (query: string) => void;
}

export const useContentLibraryStore = create<ContentLibraryState>((set) => ({
  entries: [],
  totalCount: 0,
  isLoading: false,
  error: null,
  categoryFilter: null,
  searchQuery: '',

  setEntries: (entries, totalCount) => set({ entries, totalCount }),
  addEntry: (entry) => set((state) => ({
    entries: [entry, ...state.entries],
    totalCount: state.totalCount + 1,
  })),
  addEntries: (entries) => set((state) => ({
    entries: [...entries, ...state.entries],
    totalCount: state.totalCount + entries.length,
  })),
  updateEntry: (id, updates) => set((state) => ({
    entries: state.entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
  })),
  removeEntry: (id) => set((state) => ({
    entries: state.entries.filter((e) => e.id !== id),
    totalCount: state.totalCount - 1,
  })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));

// Co-located API functions
export async function fetchContentLibrary(
  slug: string,
  params?: { category?: string; search?: string }
): Promise<{ entries: ContentLibraryEntry[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set('category', params.category);
  if (params?.search) searchParams.set('search', params.search);

  const response = await fetch(
    `/api/projects/${slug}/content-library?${searchParams.toString()}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch content library');
  }

  const data = await response.json();
  return { entries: data.entries, total: data.total };
}

export async function createContentLibraryEntryApi(
  slug: string,
  input: CreateContentLibraryEntryInput
): Promise<ContentLibraryEntry> {
  const response = await fetch(`/api/projects/${slug}/content-library`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to create entry');
  }

  const data = await response.json();
  return data.entry;
}

export async function bulkCreateContentLibraryApi(
  slug: string,
  entries: CreateContentLibraryEntryInput[]
): Promise<ContentLibraryEntry[]> {
  const response = await fetch(`/api/projects/${slug}/content-library`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to create entries');
  }

  const data = await response.json();
  return data.entries;
}

export async function updateContentLibraryEntryApi(
  slug: string,
  entryId: string,
  input: UpdateContentLibraryEntryInput
): Promise<ContentLibraryEntry> {
  const response = await fetch(`/api/projects/${slug}/content-library/${entryId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to update entry');
  }

  const data = await response.json();
  return data.entry;
}

export async function deleteContentLibraryEntryApi(
  slug: string,
  entryId: string
): Promise<void> {
  const response = await fetch(`/api/projects/${slug}/content-library/${entryId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete entry');
  }
}

export async function searchContentLibraryApi(
  slug: string,
  query: string,
  options?: { category?: string; limit?: number }
): Promise<ContentLibraryEntry[]> {
  const response = await fetch(`/api/projects/${slug}/content-library/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, ...options }),
  });

  if (!response.ok) {
    throw new Error('Failed to search content library');
  }

  const data = await response.json();
  return data.entries;
}

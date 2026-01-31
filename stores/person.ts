import { create } from 'zustand';
import type { Person, PersonWithRelations } from '@/types/person';
import type { CreatePersonInput, UpdatePersonInput } from '@/lib/validators/person';

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PersonState {
  people: Person[];
  currentPerson: PersonWithRelations | null;
  pagination: PaginationState;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  organizationFilter: string | null;

  // Actions
  setPeople: (people: Person[], pagination: PaginationState) => void;
  setCurrentPerson: (person: PersonWithRelations | null) => void;
  addPerson: (person: Person) => void;
  updatePerson: (id: string, updates: Partial<Person>) => void;
  removePerson: (id: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setSearchQuery: (query: string) => void;
  setSorting: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  setOrganizationFilter: (organizationId: string | null) => void;
  setPage: (page: number) => void;
  reset: () => void;
}

const initialState = {
  people: [],
  currentPerson: null,
  pagination: {
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  },
  isLoading: false,
  error: null,
  searchQuery: '',
  sortBy: 'created_at',
  sortOrder: 'desc' as const,
  organizationFilter: null,
};

export const usePersonStore = create<PersonState>((set) => ({
  ...initialState,

  setPeople: (people, pagination) =>
    set({ people, pagination, error: null, isLoading: false }),

  setCurrentPerson: (person) =>
    set({ currentPerson: person, error: null, isLoading: false }),

  addPerson: (person) =>
    set((state) => ({
      people: [person, ...state.people],
      pagination: {
        ...state.pagination,
        total: state.pagination.total + 1,
      },
    })),

  updatePerson: (id, updates) =>
    set((state) => ({
      people: state.people.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
      currentPerson:
        state.currentPerson?.id === id
          ? { ...state.currentPerson, ...updates }
          : state.currentPerson,
    })),

  removePerson: (id) =>
    set((state) => ({
      people: state.people.filter((p) => p.id !== id),
      pagination: {
        ...state.pagination,
        total: Math.max(0, state.pagination.total - 1),
      },
      currentPerson:
        state.currentPerson?.id === id ? null : state.currentPerson,
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  setSearchQuery: (searchQuery) =>
    set({ searchQuery, pagination: { ...initialState.pagination } }),

  setSorting: (sortBy, sortOrder) =>
    set({ sortBy, sortOrder, pagination: { ...initialState.pagination } }),

  setOrganizationFilter: (organizationFilter) =>
    set({ organizationFilter, pagination: { ...initialState.pagination } }),

  setPage: (page) =>
    set((state) => ({ pagination: { ...state.pagination, page } })),

  reset: () => set(initialState),
}));

// API functions
export async function fetchPeople(
  projectSlug: string,
  options: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    organizationId?: string;
  } = {}
): Promise<{
  people: Person[];
  pagination: PaginationState;
}> {
  const params = new URLSearchParams();
  if (options.page) params.set('page', options.page.toString());
  if (options.limit) params.set('limit', options.limit.toString());
  if (options.search) params.set('search', options.search);
  if (options.sortBy) params.set('sortBy', options.sortBy);
  if (options.sortOrder) params.set('sortOrder', options.sortOrder);
  if (options.organizationId) params.set('organizationId', options.organizationId);

  const response = await fetch(
    `/api/projects/${projectSlug}/people?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch people');
  }

  return response.json();
}

export async function fetchPerson(
  projectSlug: string,
  personId: string
): Promise<PersonWithRelations> {
  const response = await fetch(
    `/api/projects/${projectSlug}/people/${personId}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch person');
  }

  const data = await response.json();
  return data.person;
}

export async function createPerson(
  projectSlug: string,
  data: CreatePersonInput & { organization_id?: string }
): Promise<Person> {
  const response = await fetch(`/api/projects/${projectSlug}/people`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create person');
  }

  const result = await response.json();
  return result.person;
}

export async function updatePersonApi(
  projectSlug: string,
  personId: string,
  data: UpdatePersonInput
): Promise<Person> {
  const response = await fetch(
    `/api/projects/${projectSlug}/people/${personId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update person');
  }

  const result = await response.json();
  return result.person;
}

export async function deletePerson(
  projectSlug: string,
  personId: string
): Promise<void> {
  const response = await fetch(
    `/api/projects/${projectSlug}/people/${personId}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete person');
  }
}

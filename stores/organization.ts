import { create } from 'zustand';
import type { Organization, OrganizationWithRelations } from '@/types/organization';
import type { CreateOrganizationInput, UpdateOrganizationInput } from '@/lib/validators/organization';

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface OrganizationState {
  organizations: Organization[];
  currentOrganization: OrganizationWithRelations | null;
  pagination: PaginationState;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';

  // Actions
  setOrganizations: (organizations: Organization[], pagination: PaginationState) => void;
  setCurrentOrganization: (organization: OrganizationWithRelations | null) => void;
  addOrganization: (organization: Organization) => void;
  updateOrganization: (id: string, updates: Partial<Organization>) => void;
  removeOrganization: (id: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setSearchQuery: (query: string) => void;
  setSorting: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  setPage: (page: number) => void;
  reset: () => void;
}

const initialState = {
  organizations: [],
  currentOrganization: null,
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
};

export const useOrganizationStore = create<OrganizationState>((set) => ({
  ...initialState,

  setOrganizations: (organizations, pagination) =>
    set({ organizations, pagination, error: null, isLoading: false }),

  setCurrentOrganization: (organization) =>
    set({ currentOrganization: organization, error: null, isLoading: false }),

  addOrganization: (organization) =>
    set((state) => ({
      organizations: [organization, ...state.organizations],
      pagination: {
        ...state.pagination,
        total: state.pagination.total + 1,
      },
    })),

  updateOrganization: (id, updates) =>
    set((state) => ({
      organizations: state.organizations.map((org) =>
        org.id === id ? { ...org, ...updates } : org
      ),
      currentOrganization:
        state.currentOrganization?.id === id
          ? { ...state.currentOrganization, ...updates }
          : state.currentOrganization,
    })),

  removeOrganization: (id) =>
    set((state) => ({
      organizations: state.organizations.filter((org) => org.id !== id),
      pagination: {
        ...state.pagination,
        total: Math.max(0, state.pagination.total - 1),
      },
      currentOrganization:
        state.currentOrganization?.id === id ? null : state.currentOrganization,
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  setSearchQuery: (searchQuery) =>
    set({ searchQuery, pagination: { ...initialState.pagination } }),

  setSorting: (sortBy, sortOrder) =>
    set({ sortBy, sortOrder, pagination: { ...initialState.pagination } }),

  setPage: (page) =>
    set((state) => ({ pagination: { ...state.pagination, page } })),

  reset: () => set(initialState),
}));

// API functions
export async function fetchOrganizations(
  projectSlug: string,
  options: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  } = {}
): Promise<{
  organizations: Organization[];
  pagination: PaginationState;
}> {
  const params = new URLSearchParams();
  if (options.page) params.set('page', options.page.toString());
  if (options.limit) params.set('limit', options.limit.toString());
  if (options.search) params.set('search', options.search);
  if (options.sortBy) params.set('sortBy', options.sortBy);
  if (options.sortOrder) params.set('sortOrder', options.sortOrder);

  const response = await fetch(
    `/api/projects/${projectSlug}/organizations?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch organizations');
  }

  return response.json();
}

export async function fetchOrganization(
  projectSlug: string,
  organizationId: string
): Promise<OrganizationWithRelations> {
  const response = await fetch(
    `/api/projects/${projectSlug}/organizations/${organizationId}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch organization');
  }

  const data = await response.json();
  return data.organization;
}

export async function createOrganization(
  projectSlug: string,
  data: CreateOrganizationInput
): Promise<Organization> {
  const response = await fetch(`/api/projects/${projectSlug}/organizations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create organization');
  }

  const result = await response.json();
  return result.organization;
}

export async function updateOrganizationApi(
  projectSlug: string,
  organizationId: string,
  data: UpdateOrganizationInput
): Promise<Organization> {
  const response = await fetch(
    `/api/projects/${projectSlug}/organizations/${organizationId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update organization');
  }

  const result = await response.json();
  return result.organization;
}

export async function deleteOrganization(
  projectSlug: string,
  organizationId: string
): Promise<void> {
  const response = await fetch(
    `/api/projects/${projectSlug}/organizations/${organizationId}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete organization');
  }
}

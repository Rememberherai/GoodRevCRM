import { create } from 'zustand';
import type { Rfp, RfpWithRelations, RfpStatus } from '@/types/rfp';
import type { CreateRfpInput, UpdateRfpInput } from '@/lib/validators/rfp';

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface RfpState {
  rfps: Rfp[];
  currentRfp: RfpWithRelations | null;
  pagination: PaginationState;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  statusFilter: RfpStatus | null;
  organizationFilter: string | null;
  sourceFilter: string | null;
  regionFilter: string | null;
  committeeFilter: string | null;
  minConfidenceFilter: number | null;

  // Actions
  setRfps: (rfps: Rfp[], pagination: PaginationState) => void;
  setCurrentRfp: (rfp: RfpWithRelations | null) => void;
  addRfp: (rfp: Rfp) => void;
  updateRfp: (id: string, updates: Partial<Rfp>) => void;
  removeRfp: (id: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setSearchQuery: (query: string) => void;
  setSorting: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  setStatusFilter: (status: RfpStatus | null) => void;
  setOrganizationFilter: (organizationId: string | null) => void;
  setSourceFilter: (source: string | null) => void;
  setRegionFilter: (region: string | null) => void;
  setCommitteeFilter: (committee: string | null) => void;
  setMinConfidenceFilter: (confidence: number | null) => void;
  setPage: (page: number) => void;
  reset: () => void;
}

const initialState = {
  rfps: [],
  currentRfp: null,
  pagination: {
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  },
  isLoading: false,
  error: null,
  searchQuery: '',
  sortBy: 'due_date',
  sortOrder: 'asc' as const,
  statusFilter: null,
  organizationFilter: null,
  sourceFilter: null,
  regionFilter: null,
  committeeFilter: null,
  minConfidenceFilter: null,
};

export const useRfpStore = create<RfpState>((set) => ({
  ...initialState,

  setRfps: (rfps, pagination) =>
    set({ rfps, pagination, error: null, isLoading: false }),

  setCurrentRfp: (rfp) =>
    set({ currentRfp: rfp, error: null, isLoading: false }),

  addRfp: (rfp) =>
    set((state) => ({
      rfps: [rfp, ...state.rfps],
      pagination: {
        ...state.pagination,
        total: state.pagination.total + 1,
      },
    })),

  updateRfp: (id, updates) =>
    set((state) => ({
      rfps: state.rfps.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      ),
      currentRfp:
        state.currentRfp?.id === id
          ? { ...state.currentRfp, ...updates }
          : state.currentRfp,
    })),

  removeRfp: (id) =>
    set((state) => ({
      rfps: state.rfps.filter((r) => r.id !== id),
      pagination: {
        ...state.pagination,
        total: Math.max(0, state.pagination.total - 1),
      },
      currentRfp:
        state.currentRfp?.id === id ? null : state.currentRfp,
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  setSearchQuery: (searchQuery) =>
    set({ searchQuery, pagination: { ...initialState.pagination } }),

  setSorting: (sortBy, sortOrder) =>
    set({ sortBy, sortOrder, pagination: { ...initialState.pagination } }),

  setStatusFilter: (statusFilter) =>
    set({ statusFilter, pagination: { ...initialState.pagination } }),

  setOrganizationFilter: (organizationFilter) =>
    set({ organizationFilter, pagination: { ...initialState.pagination } }),

  setSourceFilter: (sourceFilter) =>
    set({ sourceFilter, pagination: { ...initialState.pagination } }),

  setRegionFilter: (regionFilter) =>
    set({ regionFilter, pagination: { ...initialState.pagination } }),

  setCommitteeFilter: (committeeFilter) =>
    set({ committeeFilter, pagination: { ...initialState.pagination } }),

  setMinConfidenceFilter: (minConfidenceFilter) =>
    set({ minConfidenceFilter, pagination: { ...initialState.pagination } }),

  setPage: (page) =>
    set((state) => ({ pagination: { ...state.pagination, page } })),

  reset: () => set(initialState),
}));

// API functions
export async function fetchRfps(
  projectSlug: string,
  options: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    status?: RfpStatus;
    organizationId?: string;
    upcoming?: boolean;
    source?: string;
    region?: string;
    committee?: string;
    minConfidence?: number;
  } = {}
): Promise<{
  rfps: Rfp[];
  pagination: PaginationState;
}> {
  const params = new URLSearchParams();
  if (options.page) params.set('page', options.page.toString());
  if (options.limit) params.set('limit', options.limit.toString());
  if (options.search) params.set('search', options.search);
  if (options.sortBy) params.set('sortBy', options.sortBy);
  if (options.sortOrder) params.set('sortOrder', options.sortOrder);
  if (options.status) params.set('status', options.status);
  if (options.organizationId) params.set('organizationId', options.organizationId);
  if (options.upcoming) params.set('upcoming', 'true');
  if (options.source) params.set('source', options.source);
  if (options.region) params.set('region', options.region);
  if (options.committee) params.set('committee', options.committee);
  if (options.minConfidence !== undefined) params.set('minConfidence', options.minConfidence.toString());

  const response = await fetch(
    `/api/projects/${projectSlug}/rfps?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch RFPs');
  }

  return response.json();
}

export async function fetchRfp(
  projectSlug: string,
  rfpId: string
): Promise<RfpWithRelations> {
  const response = await fetch(
    `/api/projects/${projectSlug}/rfps/${rfpId}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch RFP');
  }

  const data = await response.json();
  return data.rfp;
}

export async function createRfp(
  projectSlug: string,
  data: CreateRfpInput
): Promise<Rfp> {
  const response = await fetch(`/api/projects/${projectSlug}/rfps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create RFP');
  }

  const result = await response.json();
  return result.rfp;
}

export async function updateRfpApi(
  projectSlug: string,
  rfpId: string,
  data: UpdateRfpInput
): Promise<Rfp> {
  const response = await fetch(
    `/api/projects/${projectSlug}/rfps/${rfpId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update RFP');
  }

  const result = await response.json();
  return result.rfp;
}

export async function deleteRfp(
  projectSlug: string,
  rfpId: string
): Promise<void> {
  const response = await fetch(
    `/api/projects/${projectSlug}/rfps/${rfpId}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete RFP');
  }
}

import { create } from 'zustand';
import type { Opportunity, OpportunityWithRelations, OpportunityStage } from '@/types/opportunity';
import type { CreateOpportunityInput, UpdateOpportunityInput } from '@/lib/validators/opportunity';

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface OpportunityState {
  opportunities: Opportunity[];
  currentOpportunity: OpportunityWithRelations | null;
  pagination: PaginationState;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  stageFilter: OpportunityStage | null;
  organizationFilter: string | null;

  // Actions
  setOpportunities: (opportunities: Opportunity[], pagination: PaginationState) => void;
  setCurrentOpportunity: (opportunity: OpportunityWithRelations | null) => void;
  addOpportunity: (opportunity: Opportunity) => void;
  updateOpportunity: (id: string, updates: Partial<Opportunity>) => void;
  removeOpportunity: (id: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setSearchQuery: (query: string) => void;
  setSorting: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  setStageFilter: (stage: OpportunityStage | null) => void;
  setOrganizationFilter: (organizationId: string | null) => void;
  setPage: (page: number) => void;
  reset: () => void;
}

const initialState = {
  opportunities: [],
  currentOpportunity: null,
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
  stageFilter: null,
  organizationFilter: null,
};

export const useOpportunityStore = create<OpportunityState>((set) => ({
  ...initialState,

  setOpportunities: (opportunities, pagination) =>
    set({ opportunities, pagination, error: null, isLoading: false }),

  setCurrentOpportunity: (opportunity) =>
    set({ currentOpportunity: opportunity, error: null, isLoading: false }),

  addOpportunity: (opportunity) =>
    set((state) => ({
      opportunities: [opportunity, ...state.opportunities],
      pagination: {
        ...state.pagination,
        total: state.pagination.total + 1,
      },
    })),

  updateOpportunity: (id, updates) =>
    set((state) => ({
      opportunities: state.opportunities.map((o) =>
        o.id === id ? { ...o, ...updates } : o
      ),
      currentOpportunity:
        state.currentOpportunity?.id === id
          ? { ...state.currentOpportunity, ...updates }
          : state.currentOpportunity,
    })),

  removeOpportunity: (id) =>
    set((state) => ({
      opportunities: state.opportunities.filter((o) => o.id !== id),
      pagination: {
        ...state.pagination,
        total: Math.max(0, state.pagination.total - 1),
      },
      currentOpportunity:
        state.currentOpportunity?.id === id ? null : state.currentOpportunity,
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  setSearchQuery: (searchQuery) =>
    set({ searchQuery, pagination: { ...initialState.pagination } }),

  setSorting: (sortBy, sortOrder) =>
    set({ sortBy, sortOrder, pagination: { ...initialState.pagination } }),

  setStageFilter: (stageFilter) =>
    set({ stageFilter, pagination: { ...initialState.pagination } }),

  setOrganizationFilter: (organizationFilter) =>
    set({ organizationFilter, pagination: { ...initialState.pagination } }),

  setPage: (page) =>
    set((state) => ({ pagination: { ...state.pagination, page } })),

  reset: () => set(initialState),
}));

// API functions
export async function fetchOpportunities(
  projectSlug: string,
  options: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    stage?: OpportunityStage;
    organizationId?: string;
    primaryContactId?: string;
  } = {}
): Promise<{
  opportunities: Opportunity[];
  pagination: PaginationState;
}> {
  const params = new URLSearchParams();
  if (options.page) params.set('page', options.page.toString());
  if (options.limit) params.set('limit', options.limit.toString());
  if (options.search) params.set('search', options.search);
  if (options.sortBy) params.set('sortBy', options.sortBy);
  if (options.sortOrder) params.set('sortOrder', options.sortOrder);
  if (options.stage) params.set('stage', options.stage);
  if (options.organizationId) params.set('organizationId', options.organizationId);
  if (options.primaryContactId) params.set('primaryContactId', options.primaryContactId);

  const response = await fetch(
    `/api/projects/${projectSlug}/opportunities?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch opportunities');
  }

  return response.json();
}

export async function fetchOpportunity(
  projectSlug: string,
  opportunityId: string
): Promise<OpportunityWithRelations> {
  const response = await fetch(
    `/api/projects/${projectSlug}/opportunities/${opportunityId}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch opportunity');
  }

  const data = await response.json();
  return data.opportunity;
}

export async function createOpportunity(
  projectSlug: string,
  data: CreateOpportunityInput
): Promise<Opportunity> {
  const response = await fetch(`/api/projects/${projectSlug}/opportunities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create opportunity');
  }

  const result = await response.json();
  return result.opportunity;
}

export async function updateOpportunityApi(
  projectSlug: string,
  opportunityId: string,
  data: UpdateOpportunityInput
): Promise<Opportunity> {
  const response = await fetch(
    `/api/projects/${projectSlug}/opportunities/${opportunityId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update opportunity');
  }

  const result = await response.json();
  return result.opportunity;
}

export async function deleteOpportunity(
  projectSlug: string,
  opportunityId: string
): Promise<void> {
  const response = await fetch(
    `/api/projects/${projectSlug}/opportunities/${opportunityId}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete opportunity');
  }
}

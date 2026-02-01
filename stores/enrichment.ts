import { create } from 'zustand';
import type { EnrichmentJob } from '@/types/enrichment';

export interface PendingEnrichment {
  jobId: string;
  personId: string;
  personName: string;
  projectSlug: string;
  startedAt: string;
}

interface EnrichmentState {
  // Track pending enrichments across the app (keyed by personId)
  pendingEnrichments: Record<string, PendingEnrichment>;

  // Completed enrichments waiting for review (keyed by personId)
  completedEnrichments: Record<string, EnrichmentJob>;

  // Actions
  startEnrichment: (enrichment: PendingEnrichment) => void;
  completeEnrichment: (personId: string, job: EnrichmentJob) => void;
  failEnrichment: (personId: string) => void;
  clearEnrichment: (personId: string) => void;
  isEnriching: (personId: string) => boolean;
  getCompletedEnrichment: (personId: string) => EnrichmentJob | undefined;
  getPendingEnrichments: () => PendingEnrichment[];
}

export const useEnrichmentStore = create<EnrichmentState>((set, get) => ({
  pendingEnrichments: {},
  completedEnrichments: {},

  startEnrichment: (enrichment) =>
    set((state) => ({
      pendingEnrichments: {
        ...state.pendingEnrichments,
        [enrichment.personId]: enrichment,
      },
    })),

  completeEnrichment: (personId, job) =>
    set((state) => {
      const { [personId]: _, ...remainingPending } = state.pendingEnrichments;
      return {
        pendingEnrichments: remainingPending,
        completedEnrichments: {
          ...state.completedEnrichments,
          [personId]: job,
        },
      };
    }),

  failEnrichment: (personId) =>
    set((state) => {
      const { [personId]: _, ...remainingPending } = state.pendingEnrichments;
      return {
        pendingEnrichments: remainingPending,
      };
    }),

  clearEnrichment: (personId) =>
    set((state) => {
      const { [personId]: _p, ...remainingPending } = state.pendingEnrichments;
      const { [personId]: _c, ...remainingCompleted } = state.completedEnrichments;
      return {
        pendingEnrichments: remainingPending,
        completedEnrichments: remainingCompleted,
      };
    }),

  isEnriching: (personId) => {
    return personId in get().pendingEnrichments;
  },

  getCompletedEnrichment: (personId) => {
    return get().completedEnrichments[personId];
  },

  getPendingEnrichments: () => {
    return Object.values(get().pendingEnrichments);
  },
}));

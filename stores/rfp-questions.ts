import { create } from 'zustand';
import type { RfpQuestion, RfpQuestionStatus, RfpQuestionCounts } from '@/types/rfp-question';
import type { CreateRfpQuestionInput, UpdateRfpQuestionInput, BulkCreateRfpQuestionsInput } from '@/lib/validators/rfp-question';

interface RfpQuestionsState {
  questions: RfpQuestion[];
  counts: RfpQuestionCounts;
  sections: string[];
  isLoading: boolean;
  error: string | null;
  statusFilter: RfpQuestionStatus | null;
  sectionFilter: string | null;

  // Actions
  setQuestions: (questions: RfpQuestion[], counts: RfpQuestionCounts, sections: string[]) => void;
  addQuestion: (question: RfpQuestion) => void;
  addQuestions: (questions: RfpQuestion[]) => void;
  updateQuestion: (id: string, updates: Partial<RfpQuestion>) => void;
  removeQuestion: (id: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setStatusFilter: (status: RfpQuestionStatus | null) => void;
  setSectionFilter: (section: string | null) => void;
  reset: () => void;
}

const initialCounts: RfpQuestionCounts = {
  total: 0,
  unanswered: 0,
  draft: 0,
  review: 0,
  approved: 0,
};

const initialState = {
  questions: [],
  counts: initialCounts,
  sections: [],
  isLoading: false,
  error: null,
  statusFilter: null,
  sectionFilter: null,
};

function recalculateCounts(questions: RfpQuestion[]): RfpQuestionCounts {
  return {
    total: questions.length,
    unanswered: questions.filter(q => q.status === 'unanswered').length,
    draft: questions.filter(q => q.status === 'draft').length,
    review: questions.filter(q => q.status === 'review').length,
    approved: questions.filter(q => q.status === 'approved').length,
  };
}

function recalculateSections(questions: RfpQuestion[]): string[] {
  return [...new Set(questions.map(q => q.section_name).filter(Boolean))] as string[];
}

export const useRfpQuestionsStore = create<RfpQuestionsState>((set) => ({
  ...initialState,

  setQuestions: (questions, counts, sections) =>
    set({ questions, counts, sections, error: null, isLoading: false }),

  addQuestion: (question) =>
    set((state) => {
      const questions = [...state.questions, question];
      return {
        questions,
        counts: recalculateCounts(questions),
        sections: recalculateSections(questions),
      };
    }),

  addQuestions: (newQuestions) =>
    set((state) => {
      const questions = [...state.questions, ...newQuestions];
      return {
        questions,
        counts: recalculateCounts(questions),
        sections: recalculateSections(questions),
      };
    }),

  updateQuestion: (id, updates) =>
    set((state) => {
      const questions = state.questions.map((q) =>
        q.id === id ? { ...q, ...updates } : q
      );
      return {
        questions,
        counts: recalculateCounts(questions),
        sections: recalculateSections(questions),
      };
    }),

  removeQuestion: (id) =>
    set((state) => {
      const questions = state.questions.filter((q) => q.id !== id);
      return {
        questions,
        counts: recalculateCounts(questions),
        sections: recalculateSections(questions),
      };
    }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  setStatusFilter: (statusFilter) => set({ statusFilter }),

  setSectionFilter: (sectionFilter) => set({ sectionFilter }),

  reset: () => set(initialState),
}));

// API functions
export async function fetchRfpQuestions(
  projectSlug: string,
  rfpId: string,
  options: {
    status?: RfpQuestionStatus;
    section?: string;
  } = {}
): Promise<{
  questions: RfpQuestion[];
  counts: RfpQuestionCounts;
  sections: string[];
  total: number;
}> {
  const params = new URLSearchParams();
  if (options.status) params.set('status', options.status);
  if (options.section) params.set('section', options.section);

  const response = await fetch(
    `/api/projects/${projectSlug}/rfps/${rfpId}/questions?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch questions');
  }

  return response.json();
}

export async function createRfpQuestionApi(
  projectSlug: string,
  rfpId: string,
  data: CreateRfpQuestionInput
): Promise<RfpQuestion> {
  const response = await fetch(
    `/api/projects/${projectSlug}/rfps/${rfpId}/questions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create question');
  }

  const result = await response.json();
  return result.question;
}

export async function bulkCreateRfpQuestionsApi(
  projectSlug: string,
  rfpId: string,
  data: BulkCreateRfpQuestionsInput
): Promise<RfpQuestion[]> {
  const response = await fetch(
    `/api/projects/${projectSlug}/rfps/${rfpId}/questions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create questions');
  }

  const result = await response.json();
  return result.questions;
}

export async function updateRfpQuestionApi(
  projectSlug: string,
  rfpId: string,
  questionId: string,
  data: UpdateRfpQuestionInput
): Promise<RfpQuestion> {
  const response = await fetch(
    `/api/projects/${projectSlug}/rfps/${rfpId}/questions/${questionId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update question');
  }

  const result = await response.json();
  return result.question;
}

export async function deleteRfpQuestionApi(
  projectSlug: string,
  rfpId: string,
  questionId: string
): Promise<void> {
  const response = await fetch(
    `/api/projects/${projectSlug}/rfps/${rfpId}/questions/${questionId}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete question');
  }
}

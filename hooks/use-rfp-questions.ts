'use client';

import { useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  useRfpQuestionsStore,
  fetchRfpQuestions,
  createRfpQuestionApi,
  bulkCreateRfpQuestionsApi,
  updateRfpQuestionApi,
  deleteRfpQuestionApi,
} from '@/stores/rfp-questions';
import type { CreateRfpQuestionInput, UpdateRfpQuestionInput } from '@/lib/validators/rfp-question';
import type { RfpQuestionStatus } from '@/types/rfp-question';

export function useRfpQuestions(rfpId: string) {
  const params = useParams();
  const projectSlug = params.slug as string;

  const {
    questions,
    counts,
    sections,
    isLoading,
    error,
    statusFilter,
    sectionFilter,
    setQuestions,
    addQuestion,
    addQuestions,
    updateQuestion,
    removeQuestion,
    setLoading,
    setError,
    setStatusFilter,
    setSectionFilter,
  } = useRfpQuestionsStore();

  const loadQuestions = useCallback(async () => {
    if (!projectSlug || !rfpId) return;

    setLoading(true);
    try {
      const result = await fetchRfpQuestions(projectSlug, rfpId);
      setQuestions(result.questions, result.counts, result.sections);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch questions');
    }
  }, [projectSlug, rfpId, setQuestions, setLoading, setError]);

  const create = useCallback(
    async (data: CreateRfpQuestionInput) => {
      if (!projectSlug || !rfpId) throw new Error('Invalid parameters');

      try {
        const question = await createRfpQuestionApi(projectSlug, rfpId, data);
        addQuestion(question);
        return question;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create question';
        setError(message);
        throw err;
      }
    },
    [projectSlug, rfpId, addQuestion, setError]
  );

  const bulkCreate = useCallback(
    async (questionsData: CreateRfpQuestionInput[]) => {
      if (!projectSlug || !rfpId) throw new Error('Invalid parameters');

      try {
        const created = await bulkCreateRfpQuestionsApi(projectSlug, rfpId, {
          questions: questionsData,
        });
        addQuestions(created);
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create questions';
        setError(message);
        throw err;
      }
    },
    [projectSlug, rfpId, addQuestions, setError]
  );

  const update = useCallback(
    async (questionId: string, data: UpdateRfpQuestionInput) => {
      if (!projectSlug || !rfpId) throw new Error('Invalid parameters');

      try {
        const question = await updateRfpQuestionApi(projectSlug, rfpId, questionId, data);
        updateQuestion(questionId, question);
        return question;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update question';
        setError(message);
        throw err;
      }
    },
    [projectSlug, rfpId, updateQuestion, setError]
  );

  const remove = useCallback(
    async (questionId: string) => {
      if (!projectSlug || !rfpId) throw new Error('Invalid parameters');

      try {
        await deleteRfpQuestionApi(projectSlug, rfpId, questionId);
        removeQuestion(questionId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete question';
        setError(message);
        throw err;
      }
    },
    [projectSlug, rfpId, removeQuestion, setError]
  );

  const filterByStatus = useCallback(
    (status: RfpQuestionStatus | null) => {
      setStatusFilter(status);
    },
    [setStatusFilter]
  );

  const filterBySection = useCallback(
    (section: string | null) => {
      setSectionFilter(section);
    },
    [setSectionFilter]
  );

  // Get filtered questions (client-side filtering since we load all)
  const filteredQuestions = questions.filter((q) => {
    if (statusFilter && q.status !== statusFilter) return false;
    if (sectionFilter && q.section_name !== sectionFilter) return false;
    return true;
  });

  // Group by section
  const questionsBySection = filteredQuestions.reduce<Record<string, typeof filteredQuestions>>(
    (acc, q) => {
      const section = q.section_name || 'General';
      if (!acc[section]) acc[section] = [];
      acc[section].push(q);
      return acc;
    },
    {}
  );

  // Load questions on mount
  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  return {
    questions: filteredQuestions,
    questionsBySection,
    allQuestions: questions,
    counts,
    sections,
    isLoading,
    error,
    statusFilter,
    sectionFilter,
    refresh: loadQuestions,
    create,
    bulkCreate,
    update,
    remove,
    filterByStatus,
    filterBySection,
  };
}

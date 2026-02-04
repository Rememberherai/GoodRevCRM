'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import type { RfpQuestionComment } from '@/types/rfp-question-comment';
import type { CreateRfpQuestionCommentInput } from '@/lib/validators/rfp-question-comment';

const POLL_INTERVAL = 15000; // 15 seconds

export function useRfpQuestionComments(rfpId: string, questionId: string) {
  const params = useParams();
  const projectSlug = params.slug as string;

  const [comments, setComments] = useState<RfpQuestionComment[]>([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchComments = useCallback(async () => {
    if (!projectSlug || !rfpId || !questionId) return;

    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/rfps/${rfpId}/questions/${questionId}/comments`
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch comments');
      }

      const data = await response.json();
      setComments(data.comments ?? []);
      setCount(data.count ?? 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch comments');
    } finally {
      setIsLoading(false);
    }
  }, [projectSlug, rfpId, questionId]);

  const addComment = useCallback(
    async (input: CreateRfpQuestionCommentInput) => {
      const response = await fetch(
        `/api/projects/${projectSlug}/rfps/${rfpId}/questions/${questionId}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add comment');
      }

      const data = await response.json();
      setComments((prev) => [...prev, data.comment]);
      setCount((prev) => prev + 1);
      return data.comment;
    },
    [projectSlug, rfpId, questionId]
  );

  const deleteComment = useCallback(
    async (commentId: string) => {
      const response = await fetch(
        `/api/projects/${projectSlug}/rfps/${rfpId}/questions/${questionId}/comments/${commentId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete comment');
      }

      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setCount((prev) => Math.max(0, prev - 1));
    },
    [projectSlug, rfpId, questionId]
  );

  // Initial fetch + polling
  useEffect(() => {
    fetchComments();
    intervalRef.current = setInterval(fetchComments, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchComments]);

  return {
    comments,
    count,
    isLoading,
    error,
    addComment,
    deleteComment,
    refresh: fetchComments,
  };
}

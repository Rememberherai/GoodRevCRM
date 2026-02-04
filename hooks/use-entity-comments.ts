'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import type { EntityComment, CommentEntityType } from '@/types/entity-comment';
import type { CreateEntityCommentInput, UpdateEntityCommentInput } from '@/lib/validators/entity-comment';

const POLL_INTERVAL = 15000; // 15 seconds

export function useEntityComments(entityType: CommentEntityType, entityId: string) {
  const params = useParams();
  const projectSlug = params.slug as string;

  const [comments, setComments] = useState<EntityComment[]>([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchComments = useCallback(async () => {
    if (!projectSlug || !entityType || !entityId) return;

    try {
      const params = new URLSearchParams({ entity_type: entityType, entity_id: entityId });
      const response = await fetch(
        `/api/projects/${projectSlug}/comments?${params}`
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
  }, [projectSlug, entityType, entityId]);

  const addComment = useCallback(
    async (input: Omit<CreateEntityCommentInput, 'entity_type' | 'entity_id'>) => {
      const response = await fetch(
        `/api/projects/${projectSlug}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entity_type: entityType,
            entity_id: entityId,
            ...input,
          }),
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
    [projectSlug, entityType, entityId]
  );

  const deleteComment = useCallback(
    async (commentId: string) => {
      const response = await fetch(
        `/api/projects/${projectSlug}/comments/${commentId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete comment');
      }

      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setCount((prev) => Math.max(0, prev - 1));
    },
    [projectSlug]
  );

  const editComment = useCallback(
    async (commentId: string, input: UpdateEntityCommentInput) => {
      const response = await fetch(
        `/api/projects/${projectSlug}/comments/${commentId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to edit comment');
      }

      const data = await response.json();
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? data.comment : c))
      );
      return data.comment;
    },
    [projectSlug]
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
    editComment,
    refresh: fetchComments,
  };
}

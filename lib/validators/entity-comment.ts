import { z } from 'zod';

export const commentMentionSchema = z.object({
  user_id: z.string().uuid(),
  display_name: z.string().min(1),
});

export const createEntityCommentSchema = z.object({
  entity_type: z.enum(['person', 'organization', 'opportunity']),
  entity_id: z.string().uuid(),
  content: z.string().min(1, 'Comment cannot be empty').max(5000, 'Comment must be 5000 characters or less'),
  mentions: z.array(commentMentionSchema).default([]),
});

export const updateEntityCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(5000, 'Comment must be 5000 characters or less'),
  mentions: z.array(commentMentionSchema).default([]),
});

export type CreateEntityCommentInput = z.infer<typeof createEntityCommentSchema>;
export type UpdateEntityCommentInput = z.infer<typeof updateEntityCommentSchema>;

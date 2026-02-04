import { z } from 'zod';

export const createRfpQuestionCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(2000, 'Comment must be 2000 characters or less'),
});

export type CreateRfpQuestionCommentInput = z.infer<typeof createRfpQuestionCommentSchema>;

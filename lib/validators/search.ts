import { z } from 'zod';

// Search query schema
export const searchQuerySchema = z.object({
  q: z.string().min(1, 'Query is required').max(200),
  entity_types: z.array(z.enum(['organization', 'person', 'opportunity', 'rfp'])).optional(),
  limit: z.coerce.number().min(1).max(50).optional().default(20),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

// Global search schema
export const globalSearchSchema = z.object({
  query: z.string().min(1, 'Query is required').max(200).transform((v) => v.trim()),
  types: z
    .array(z.enum(['person', 'organization', 'opportunity', 'rfp', 'task', 'note']))
    .optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(25),
});

export type GlobalSearchQuery = z.infer<typeof globalSearchSchema>;

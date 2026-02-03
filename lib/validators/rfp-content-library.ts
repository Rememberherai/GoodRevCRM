import { z } from 'zod';
import { CONTENT_CATEGORIES } from '@/types/rfp-content-library';

export const contentLibraryEntrySchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(500, 'Title must be 500 characters or less'),
  question_text: z
    .string()
    .max(5000, 'Question text must be 5000 characters or less')
    .nullable()
    .optional(),
  answer_text: z
    .string()
    .min(1, 'Answer text is required')
    .max(20000, 'Answer must be 20000 characters or less'),
  answer_html: z
    .string()
    .max(40000, 'Answer HTML must be 40000 characters or less')
    .nullable()
    .optional(),
  category: z
    .enum(CONTENT_CATEGORIES)
    .nullable()
    .optional(),
  tags: z
    .array(z.string().max(100))
    .max(20, 'Maximum 20 tags')
    .optional()
    .default([]),
  source_rfp_id: z
    .string()
    .uuid()
    .nullable()
    .optional(),
  source_question_id: z
    .string()
    .uuid()
    .nullable()
    .optional(),
  source_document_name: z
    .string()
    .max(255)
    .nullable()
    .optional(),
});

export const createContentLibraryEntrySchema = contentLibraryEntrySchema;
export const updateContentLibraryEntrySchema = contentLibraryEntrySchema.partial();

export const bulkCreateContentLibrarySchema = z.object({
  entries: z
    .array(contentLibraryEntrySchema)
    .min(1, 'At least one entry is required')
    .max(100, 'Maximum 100 entries per batch'),
});

export const searchContentLibrarySchema = z.object({
  query: z.string().min(1).max(500),
  category: z.enum(CONTENT_CATEGORIES).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

export type CreateContentLibraryEntryInput = z.infer<typeof createContentLibraryEntrySchema>;
export type UpdateContentLibraryEntryInput = z.infer<typeof updateContentLibraryEntrySchema>;
export type BulkCreateContentLibraryInput = z.infer<typeof bulkCreateContentLibrarySchema>;
export type SearchContentLibraryInput = z.infer<typeof searchContentLibrarySchema>;

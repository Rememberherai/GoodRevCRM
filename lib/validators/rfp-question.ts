import { z } from 'zod';

export const rfpQuestionStatuses = ['unanswered', 'draft', 'review', 'approved'] as const;
export const questionPriorities = ['low', 'medium', 'high', 'critical'] as const;

export const rfpQuestionSchema = z.object({
  section_name: z
    .string()
    .max(200, 'Section name must be 200 characters or less')
    .nullable()
    .optional(),
  question_number: z
    .string()
    .max(50, 'Question number must be 50 characters or less')
    .nullable()
    .optional(),
  question_text: z
    .string()
    .min(1, 'Question text is required')
    .max(5000, 'Question text must be 5000 characters or less'),
  answer_text: z
    .string()
    .max(10000, 'Answer must be 10000 characters or less')
    .nullable()
    .optional(),
  answer_html: z
    .string()
    .max(20000, 'Answer HTML must be 20000 characters or less')
    .nullable()
    .optional(),
  status: z.enum(rfpQuestionStatuses).default('unanswered'),
  priority: z
    .enum(questionPriorities)
    .nullable()
    .optional(),
  assigned_to: z
    .string()
    .uuid('Must be a valid UUID')
    .nullable()
    .optional(),
  sort_order: z
    .number()
    .int()
    .min(0)
    .optional(),
  notes: z
    .string()
    .max(2000, 'Notes must be 2000 characters or less')
    .nullable()
    .optional(),
});

export const createRfpQuestionSchema = rfpQuestionSchema;
export const updateRfpQuestionSchema = rfpQuestionSchema.partial();

export const bulkCreateRfpQuestionsSchema = z.object({
  questions: z.array(rfpQuestionSchema).min(1, 'At least one question is required').max(200, 'Maximum 200 questions per batch'),
});

export type CreateRfpQuestionInput = z.infer<typeof createRfpQuestionSchema>;
export type UpdateRfpQuestionInput = z.infer<typeof updateRfpQuestionSchema>;
export type BulkCreateRfpQuestionsInput = z.infer<typeof bulkCreateRfpQuestionsSchema>;

// AI response generation schemas
export const generateRfpResponseInputSchema = z.object({
  includeCompanyContext: z.boolean().default(true),
  includeOrgContext: z.boolean().default(true),
  includeLibraryAnswers: z.boolean().default(true),
  additionalInstructions: z.string().max(2000).optional(),
});

export const aiRfpResponseSchema = z.object({
  answer_text: z.string(),
  answer_html: z.string().optional(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
});

export type GenerateRfpResponseInput = z.infer<typeof generateRfpResponseInputSchema>;
export type AiRfpResponse = z.infer<typeof aiRfpResponseSchema>;

// AI document extraction schemas
export const extractedRfpQuestionSchema = z.object({
  question_text: z.string().min(1),
  section_name: z.string().nullable().optional(),
  question_number: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
});

export const rfpDocumentExtractionResultSchema = z.object({
  questions: z.array(extractedRfpQuestionSchema),
  document_summary: z.string().optional(),
  total_sections_found: z.number().optional(),
});

export type ExtractedRfpQuestion = z.infer<typeof extractedRfpQuestionSchema>;
export type RfpDocumentExtractionResult = z.infer<typeof rfpDocumentExtractionResultSchema>;

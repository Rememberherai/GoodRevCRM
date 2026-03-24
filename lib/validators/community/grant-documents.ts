import { z } from 'zod';

export const grantDocumentTypeSchema = z.enum([
  'narrative',
  'budget',
  'support_letter',
  'irs_determination',
  'board_list',
  'financial_audit',
  'logic_model',
  'timeline',
  'mou',
  'funder_agreement',
  'report',
  'amendment',
  'other',
]);

export const createGrantDocumentSchema = z.object({
  grant_id: z.string().uuid(),
  document_type: grantDocumentTypeSchema,
  label: z.string().min(1, 'Label is required').max(200, 'Label must be 200 characters or less'),
  file_name: z.string().min(1),
  file_size_bytes: z.number().int().nonnegative().optional(),
  mime_type: z.string().optional(),
  is_required: z.boolean().default(false),
  is_submitted: z.boolean().default(false),
  notes: z.string().max(2000, 'Notes must be 2000 characters or less').nullable().optional(),
});

export const updateGrantDocumentSchema = z.object({
  document_type: grantDocumentTypeSchema.optional(),
  label: z.string().min(1).max(200).optional(),
  is_required: z.boolean().optional(),
  is_submitted: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

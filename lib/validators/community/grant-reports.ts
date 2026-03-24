import { z } from 'zod';

export const grantReportTypeSchema = z.enum([
  'progress', 'financial', 'final', 'interim', 'annual', 'closeout', 'other',
]);

export const grantReportStatusSchema = z.enum([
  'upcoming', 'in_progress', 'submitted', 'accepted', 'revision_requested',
]);

export const createGrantReportSchema = z.object({
  grant_id: z.string().uuid(),
  report_type: grantReportTypeSchema,
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  due_date: z.string().min(1, 'Due date is required'),
  status: grantReportStatusSchema.default('upcoming'),
  document_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000, 'Notes must be 2000 characters or less').nullable().optional(),
});

export const updateGrantReportSchema = z.object({
  report_type: grantReportTypeSchema.optional(),
  title: z.string().min(1).max(200).optional(),
  due_date: z.string().optional(),
  status: grantReportStatusSchema.optional(),
  submitted_at: z.string().nullable().optional(),
  document_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

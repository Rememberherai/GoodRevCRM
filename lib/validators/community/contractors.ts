import { z } from 'zod';
import { dateTimeSchema, nullableString, optionalUuidSchema, numericCoordinateSchema } from './shared';

export const contractorScopeStatusSchema = z.enum([
  'draft',
  'pending_signature',
  'active',
  'expired',
  'cancelled',
]);

export const jobStatusSchema = z.enum([
  'draft',
  'assigned',
  'accepted',
  'in_progress',
  'paused',
  'completed',
  'declined',
  'pulled',
  'cancelled',
]);

export const jobPrioritySchema = z.enum(['high', 'medium', 'low']);

export const contractorScopeSchema = z.object({
  project_id: optionalUuidSchema,
  contractor_id: optionalUuidSchema,
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  description: nullableString(5000, 'Description must be 5000 characters or less'),
  status: contractorScopeStatusSchema.default('draft'),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  compensation_terms: nullableString(1000, 'Compensation terms must be 1000 characters or less'),
  service_categories: z.array(z.string().min(1).max(100)).max(50).default([]),
  certifications: z.array(z.string().min(1).max(100)).max(50).default([]),
  service_area_radius_miles: z.number().nonnegative().max(10000).nullable().optional(),
  home_base_latitude: numericCoordinateSchema.nullable().optional(),
  home_base_longitude: numericCoordinateSchema.nullable().optional(),
  document_url: z.string().url('Must be a valid URL').nullable().optional().or(z.literal('')),
});

export const jobSchema = z.object({
  project_id: optionalUuidSchema,
  contractor_id: optionalUuidSchema,
  assigned_by: optionalUuidSchema,
  title: z.string().min(1, 'Job title is required').max(200, 'Job title must be 200 characters or less'),
  description: nullableString(5000, 'Description must be 5000 characters or less'),
  status: jobStatusSchema.default('assigned'),
  priority: jobPrioritySchema.default('medium'),
  desired_start: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  service_address: nullableString(300, 'Service address must be 300 characters or less'),
  service_category: z.string().max(100).nullable().optional(),
  required_certifications: z.array(z.string().min(1).max(100)).max(50).default([]),
  service_latitude: numericCoordinateSchema.nullable().optional(),
  service_longitude: numericCoordinateSchema.nullable().optional(),
  is_out_of_scope: z.boolean().default(false),
  notes: nullableString(2000, 'Notes must be 2000 characters or less'),
});

const timeEntryBaseSchema = z.object({
  job_id: optionalUuidSchema,
  started_at: dateTimeSchema,
  ended_at: z.string().nullable().optional(),
  is_break: z.boolean().default(false),
  duration_minutes: z.number().int().nonnegative().nullable().optional(),
});

function validateTimeEntry(
  value: z.infer<typeof timeEntryBaseSchema> | Partial<z.infer<typeof timeEntryBaseSchema>>,
  ctx: z.RefinementCtx
) {
  if (!value.started_at || !value.ended_at) {
    return;
  }

  if (value.ended_at && Date.parse(value.ended_at) < Date.parse(value.started_at)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'ended_at must be after started_at',
      path: ['ended_at'],
    });
  }
}

export const timeEntrySchema = timeEntryBaseSchema.superRefine(validateTimeEntry);

export const createContractorScopeSchema = contractorScopeSchema;
export const updateContractorScopeSchema = contractorScopeSchema.partial();
export const createJobSchema = jobSchema;
export const updateJobSchema = jobSchema.partial();
export const createTimeEntrySchema = timeEntrySchema;
export const updateTimeEntrySchema = timeEntryBaseSchema.partial().superRefine(validateTimeEntry);

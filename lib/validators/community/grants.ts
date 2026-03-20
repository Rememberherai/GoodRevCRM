import { z } from 'zod';
import { nullableString, optionalUuidSchema } from './shared';

export const grantStatusSchema = z.enum([
  'researching',
  'preparing',
  'submitted',
  'under_review',
  'awarded',
  'declined',
]);

export const grantSchema = z.object({
  project_id: optionalUuidSchema,
  funder_organization_id: optionalUuidSchema,
  contact_person_id: optionalUuidSchema,
  assigned_to: optionalUuidSchema,
  name: z.string().min(1, 'Grant name is required').max(200, 'Grant name must be 200 characters or less'),
  status: grantStatusSchema.default('researching'),
  amount_requested: z.number().nonnegative().nullable().optional(),
  amount_awarded: z.number().nonnegative().nullable().optional(),
  loi_due_at: z.string().nullable().optional(),
  application_due_at: z.string().nullable().optional(),
  report_due_at: z.string().nullable().optional(),
  notes: nullableString(5000, 'Notes must be 5000 characters or less'),
});

export const createGrantSchema = grantSchema;
export const updateGrantSchema = grantSchema.partial();

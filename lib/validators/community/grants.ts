import { z } from 'zod';
import { nullableString, optionalUuidSchema } from './shared';

export const grantStatusSchema = z.enum([
  'researching',
  'preparing',
  'submitted',
  'under_review',
  'awarded',
  'active',
  'closed',
  'declined',
]);

export const grantMatchTypeSchema = z.enum(['cash', 'in_kind', 'either']);

export const grantAgreementStatusSchema = z.enum(['pending', 'executed', 'amended', 'expired']);

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
  // Post-award fields
  award_number: z.string().max(100, 'Award number must be 100 characters or less').nullable().optional(),
  funder_grant_id: z.string().max(100, 'Funder grant ID must be 100 characters or less').nullable().optional(),
  award_period_start: z.string().nullable().optional(),
  award_period_end: z.string().nullable().optional(),
  total_award_amount: z.number().nonnegative().nullable().optional(),
  match_required: z.number().nonnegative().nullable().optional(),
  match_type: grantMatchTypeSchema.nullable().optional(),
  indirect_cost_rate: z.number().min(0).max(1).nullable().optional(),
  agreement_status: grantAgreementStatusSchema.nullable().optional(),
  closeout_date: z.string().nullable().optional(),
  program_id: optionalUuidSchema,
  contract_document_id: optionalUuidSchema,
  // Discovery fields
  is_discovered: z.boolean().optional(),
  source_url: z.string().max(2000, 'Source URL must be 2000 characters or less').nullable().optional(),
});

export const createGrantSchema = grantSchema;
export const updateGrantSchema = grantSchema.partial();

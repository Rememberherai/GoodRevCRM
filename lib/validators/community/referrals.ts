import { z } from 'zod';
import { nullableString, optionalUuidSchema } from './shared';

export const referralStatusSchema = z.enum([
  'submitted',
  'acknowledged',
  'in_progress',
  'completed',
  'closed',
]);

export const referralBaseSchema = z.object({
  project_id: optionalUuidSchema,
  person_id: optionalUuidSchema,
  household_id: optionalUuidSchema,
  partner_organization_id: optionalUuidSchema,
  service_type: z.string().min(1, 'Service type is required').max(200, 'Service type must be 200 characters or less'),
  status: referralStatusSchema.default('submitted'),
  outcome: nullableString(2000, 'Outcome must be 2000 characters or less'),
  notes: nullableString(5000, 'Notes must be 5000 characters or less'),
});

export const referralSchema = referralBaseSchema.superRefine((value, ctx) => {
  if (!value.person_id && !value.household_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Either person_id or household_id is required',
      path: ['person_id'],
    });
  }
});

export const createReferralSchema = referralSchema;
export const updateReferralSchema = referralBaseSchema.partial();

import { z } from 'zod';
import { dateSchema, nullableString, optionalUuidSchema } from './shared';

export const contributionTypeSchema = z.enum([
  'monetary',
  'in_kind',
  'volunteer_hours',
  'grant',
  'service',
]);

export const contributionStatusSchema = z.enum(['pledged', 'received', 'completed', 'cancelled']);

const contributionBaseSchema = z.object({
  project_id: optionalUuidSchema,
  type: contributionTypeSchema,
  status: contributionStatusSchema.default('received'),
  dimension_id: optionalUuidSchema,
  program_id: optionalUuidSchema,
  grant_id: optionalUuidSchema,
  donor_person_id: optionalUuidSchema,
  donor_organization_id: optionalUuidSchema,
  donor_household_id: optionalUuidSchema,
  recipient_person_id: optionalUuidSchema,
  recipient_household_id: optionalUuidSchema,
  value: z.number().nonnegative().nullable().optional(),
  hours: z.number().nonnegative().nullable().optional(),
  currency: z.string().max(10).default('USD'),
  description: nullableString(2000, 'Description must be 2000 characters or less'),
  date: dateSchema,
});

function validateContribution(
  value: z.infer<typeof contributionBaseSchema> | Partial<z.infer<typeof contributionBaseSchema>>,
  ctx: z.RefinementCtx
) {
  if (value.type && ['monetary', 'in_kind', 'grant'].includes(value.type) && value.value == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'value is required for monetary, in-kind, and grant contributions',
      path: ['value'],
    });
  }

  if (value.type && ['volunteer_hours', 'service'].includes(value.type) && value.hours == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'hours is required for time-based contributions',
      path: ['hours'],
    });
  }
}

export const contributionSchema = contributionBaseSchema.superRefine(validateContribution);
export const createContributionSchema = contributionSchema;
export const updateContributionSchema = contributionBaseSchema.partial().superRefine((value, ctx) => {
  if (!value.type) return;
  validateContribution(value, ctx);
});

export type CreateContributionInput = z.infer<typeof createContributionSchema>;
export type UpdateContributionInput = z.infer<typeof updateContributionSchema>;

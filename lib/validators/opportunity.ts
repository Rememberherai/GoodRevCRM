import { z } from 'zod';

export const opportunityStages = [
  'prospecting',
  'qualification',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
] as const;

export const opportunitySchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(200, 'Name must be 200 characters or less'),
  description: z
    .string()
    .max(2000, 'Description must be 2000 characters or less')
    .nullable()
    .optional(),
  stage: z.enum(opportunityStages),
  amount: z
    .number()
    .min(0, 'Amount must be positive')
    .nullable()
    .optional(),
  currency: z
    .string()
    .max(10, 'Currency must be 10 characters or less'),
  probability: z
    .number()
    .int()
    .min(0, 'Probability must be at least 0')
    .max(100, 'Probability must be at most 100')
    .nullable()
    .optional(),
  expected_close_date: z
    .string()
    .nullable()
    .optional(),
  actual_close_date: z
    .string()
    .nullable()
    .optional(),
  organization_id: z
    .string()
    .uuid('Must be a valid UUID')
    .nullable()
    .optional(),
  primary_contact_id: z
    .string()
    .uuid('Must be a valid UUID')
    .nullable()
    .optional(),
  owner_id: z
    .string()
    .uuid('Must be a valid UUID')
    .nullable()
    .optional(),
  lost_reason: z
    .string()
    .max(500, 'Lost reason must be 500 characters or less')
    .nullable()
    .optional(),
  won_reason: z
    .string()
    .max(500, 'Won reason must be 500 characters or less')
    .nullable()
    .optional(),
  competitor: z
    .string()
    .max(200, 'Competitor must be 200 characters or less')
    .nullable()
    .optional(),
  source: z
    .string()
    .max(100, 'Source must be 100 characters or less')
    .nullable()
    .optional(),
  campaign: z
    .string()
    .max(100, 'Campaign must be 100 characters or less')
    .nullable()
    .optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
});

export const createOpportunitySchema = opportunitySchema;
export const updateOpportunitySchema = opportunitySchema.partial();

export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;
export type UpdateOpportunityInput = z.infer<typeof updateOpportunitySchema>;

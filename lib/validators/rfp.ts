import { z } from 'zod';

const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})?)?$/;
const isoDateString = z.string().regex(isoDateRegex, 'Must be a valid ISO 8601 date');

export const rfpStatuses = [
  'identified',
  'reviewing',
  'preparing',
  'submitted',
  'won',
  'lost',
  'no_bid',
] as const;

export const goNoGoOptions = ['go', 'no_go', 'pending'] as const;
export const submissionMethods = ['email', 'portal', 'physical', 'other'] as const;

export const rfpSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(300, 'Title must be 300 characters or less'),
  description: z
    .string()
    .max(5000, 'Description must be 5000 characters or less')
    .nullable()
    .optional(),
  status: z.enum(rfpStatuses),
  rfp_number: z
    .string()
    .max(100, 'RFP number must be 100 characters or less')
    .nullable()
    .optional(),
  organization_id: z
    .string()
    .uuid('Must be a valid UUID')
    .nullable()
    .optional(),
  opportunity_id: z
    .string()
    .uuid('Must be a valid UUID')
    .nullable()
    .optional(),
  owner_id: z
    .string()
    .uuid('Must be a valid UUID')
    .nullable()
    .optional(),
  issue_date: isoDateString
    .nullable()
    .optional(),
  due_date: isoDateString
    .nullable()
    .optional(),
  questions_due_date: isoDateString
    .nullable()
    .optional(),
  decision_date: isoDateString
    .nullable()
    .optional(),
  estimated_value: z
    .number()
    .min(0, 'Estimated value must be positive')
    .nullable()
    .optional(),
  currency: z
    .string()
    .max(10, 'Currency must be 10 characters or less'),
  budget_range: z
    .string()
    .max(100, 'Budget range must be 100 characters or less')
    .nullable()
    .optional(),
  submission_method: z
    .enum(submissionMethods)
    .nullable()
    .optional(),
  submission_portal_url: z
    .string()
    .url('Must be a valid URL')
    .max(500, 'URL must be 500 characters or less')
    .nullable()
    .optional()
    .or(z.literal('')),
  submission_email: z
    .string()
    .email('Must be a valid email')
    .max(255, 'Email must be 255 characters or less')
    .nullable()
    .optional()
    .or(z.literal('')),
  submission_instructions: z
    .string()
    .max(2000, 'Instructions must be 2000 characters or less')
    .nullable()
    .optional(),
  win_probability: z
    .number()
    .int()
    .min(0, 'Probability must be at least 0')
    .max(100, 'Probability must be at most 100')
    .nullable()
    .optional(),
  go_no_go_decision: z
    .enum(goNoGoOptions)
    .nullable()
    .optional(),
  go_no_go_date: isoDateString
    .nullable()
    .optional(),
  go_no_go_notes: z
    .string()
    .max(2000, 'Notes must be 2000 characters or less')
    .nullable()
    .optional(),
  outcome_reason: z
    .string()
    .max(1000, 'Outcome reason must be 1000 characters or less')
    .nullable()
    .optional(),
  feedback: z
    .string()
    .max(2000, 'Feedback must be 2000 characters or less')
    .nullable()
    .optional(),
  awarded_to: z
    .string()
    .max(200, 'Awarded to must be 200 characters or less')
    .nullable()
    .optional(),
  rfp_document_url: z
    .string()
    .url('Must be a valid URL')
    .max(500, 'URL must be 500 characters or less')
    .nullable()
    .optional()
    .or(z.literal('')),
  response_document_url: z
    .string()
    .url('Must be a valid URL')
    .max(500, 'URL must be 500 characters or less')
    .nullable()
    .optional()
    .or(z.literal('')),
  custom_fields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).refine(
    (obj) => Object.keys(obj).length <= 50,
    { message: 'Maximum of 50 custom fields allowed' }
  ).optional(),
});

export const createRfpSchema = rfpSchema;
export const updateRfpSchema = rfpSchema.partial();

export type CreateRfpInput = z.infer<typeof createRfpSchema>;
export type UpdateRfpInput = z.infer<typeof updateRfpSchema>;

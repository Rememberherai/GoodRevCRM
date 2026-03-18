import { z } from 'zod';

export const quoteStatuses = ['draft', 'sent', 'accepted', 'rejected', 'expired'] as const;

export const createQuoteSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less'),
  quote_number: z
    .string()
    .max(50, 'Quote number must be 50 characters or less')
    .nullable()
    .optional(),
  valid_until: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
    .nullable()
    .optional(),
  notes: z
    .string()
    .max(5000, 'Notes must be 5000 characters or less')
    .nullable()
    .optional(),
});

// PATCH: metadata only. Status restricted to 'sent' or 'expired'.
// The API route additionally enforces: 'sent' only from 'draft'.
export const updateQuoteSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(200)
    .optional(),
  quote_number: z
    .string()
    .max(50)
    .nullable()
    .optional(),
  valid_until: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  notes: z
    .string()
    .max(5000)
    .nullable()
    .optional(),
  status: z
    .enum(['sent', 'expired'])
    .optional(),
});

export const lineItemSchema = z.object({
  product_id: z.string().uuid().nullable().optional(),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(200, 'Name must be 200 characters or less'),
  description: z
    .string()
    .max(2000, 'Description must be 2000 characters or less')
    .nullable()
    .optional(),
  quantity: z
    .number()
    .min(0.01, 'Quantity must be at least 0.01')
    .max(999999, 'Quantity exceeds maximum'),
  unit_price: z
    .number()
    .min(0, 'Unit price must be positive')
    .max(999999999999, 'Unit price exceeds maximum'),
  discount_percent: z
    .number()
    .min(0, 'Discount must be 0-100%')
    .max(100, 'Discount must be 0-100%')
    .optional()
    .default(0),
  sort_order: z
    .number()
    .int()
    .min(0)
    .optional(),
});

export const updateLineItemSchema = lineItemSchema.partial();

export const bulkLineItemsSchema = z.array(lineItemSchema).max(100, 'Maximum 100 line items per quote');

export const acceptQuoteSchema = z.object({
  sync_amount: z.boolean().optional().default(false),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;
export type LineItemInput = z.infer<typeof lineItemSchema>;
export type UpdateLineItemInput = z.infer<typeof updateLineItemSchema>;
export type AcceptQuoteInput = z.infer<typeof acceptQuoteSchema>;

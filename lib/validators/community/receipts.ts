import { z } from 'zod';
import { dateSchema, jsonObjectSchema, nullableString, optionalUuidSchema } from './shared';

export const receiptConfirmationStatusSchema = z.enum([
  'draft',
  'pending_approval',
  'approved',
  'executed',
  'failed',
]);

export const receiptAccountingTargetSchema = z.enum(['goodrev', 'quickbooks']);

export const receiptConfirmationSchema = z.object({
  project_id: optionalUuidSchema,
  submitted_by: optionalUuidSchema,
  vendor: z.string().min(1, 'Vendor is required').max(200, 'Vendor must be 200 characters or less'),
  amount: z.number().nonnegative(),
  receipt_date: dateSchema,
  description: nullableString(2000, 'Description must be 2000 characters or less'),
  account_code: nullableString(100, 'Account code must be 100 characters or less'),
  class_name: nullableString(100, 'Class must be 100 characters or less'),
  ocr_raw: jsonObjectSchema.default({}),
  accounting_target: receiptAccountingTargetSchema,
  external_bill_id: z.string().max(255).nullable().optional(),
  status: receiptConfirmationStatusSchema.default('draft'),
  image_url: z.string().url('Must be a valid URL'),
  error_message: nullableString(2000, 'Error message must be 2000 characters or less'),
});

export const createReceiptConfirmationSchema = receiptConfirmationSchema;
export const updateReceiptConfirmationSchema = receiptConfirmationSchema.partial();

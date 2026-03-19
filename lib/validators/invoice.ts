import { z } from 'zod';

// ============================================================
// Invoice Line Items
// ============================================================

export const invoiceLineItemSchema = z.object({
  description: z.string().trim().min(1, 'Description is required').max(500),
  quantity: z.number().positive().default(1),
  unit_price: z.number().min(0),
  account_id: z.string().uuid('Revenue account is required'),
  tax_rate_id: z.string().uuid().optional().nullable(),
  sort_order: z.number().int().min(0).optional(),
});

// ============================================================
// Create Invoice
// ============================================================

export const createInvoiceSchema = z.object({
  customer_name: z.string().trim().min(1, 'Customer name is required').max(255),
  customer_email: z.string().email().optional().nullable(),
  customer_address: z.string().trim().max(1000).optional().nullable(),
  customer_phone: z.string().trim().max(50).optional().nullable(),
  organization_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  payment_terms: z.number().int().min(0).max(365).optional().nullable(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).default('USD'),
  exchange_rate: z.number().positive().default(1.0),
  notes: z.string().trim().max(2000).optional().nullable(),
  footer: z.string().trim().max(2000).optional().nullable(),
  line_items: z.array(invoiceLineItemSchema).min(1, 'At least 1 line item is required'),
}).superRefine((data, ctx) => {
  if (data.due_date < data.invoice_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['due_date'],
      message: 'Due date cannot be before invoice date',
    });
  }
});

// ============================================================
// Update Invoice (draft only)
// ============================================================

export const updateInvoiceSchema = z.object({
  customer_name: z.string().trim().min(1).max(255).optional(),
  customer_email: z.string().email().optional().nullable(),
  customer_address: z.string().trim().max(1000).optional().nullable(),
  customer_phone: z.string().trim().max(50).optional().nullable(),
  organization_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  payment_terms: z.number().int().min(0).max(365).optional().nullable(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
  exchange_rate: z.number().positive().optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  footer: z.string().trim().max(2000).optional().nullable(),
  line_items: z.array(invoiceLineItemSchema).min(1).optional(),
}).superRefine((data, ctx) => {
  if (data.invoice_date && data.due_date && data.due_date < data.invoice_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['due_date'],
      message: 'Due date cannot be before invoice date',
    });
  }
});

// ============================================================
// Payment
// ============================================================

export const paymentMethods = [
  'cash', 'check', 'credit_card', 'bank_transfer', 'ach', 'wire', 'other',
] as const;

export const createPaymentSchema = z.object({
  invoice_id: z.string().uuid(),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  amount: z.number().positive('Amount must be positive'),
  payment_method: z.enum(paymentMethods).optional().nullable(),
  reference: z.string().trim().max(255).optional().nullable(),
  account_id: z.string().uuid('Payment account is required'),
  notes: z.string().trim().max(2000).optional().nullable(),
});

// ============================================================
// Invoice Statuses
// ============================================================

export const invoiceStatuses = [
  'draft', 'sent', 'partially_paid', 'paid', 'overdue', 'voided', 'written_off',
] as const;

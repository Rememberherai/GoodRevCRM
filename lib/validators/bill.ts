import { z } from 'zod';

// ============================================================
// Bill Line Items
// ============================================================

export const billLineItemSchema = z.object({
  description: z.string().trim().min(1, 'Description is required').max(500),
  quantity: z.number().positive().default(1),
  unit_price: z.number().min(0),
  account_id: z.string().uuid('Expense account is required'),
  tax_rate_id: z.string().uuid().optional().nullable(),
  sort_order: z.number().int().min(0).optional(),
});

// ============================================================
// Create Bill
// ============================================================

export const createBillSchema = z.object({
  vendor_name: z.string().trim().min(1, 'Vendor name is required').max(255),
  vendor_email: z.string().email().optional().nullable(),
  vendor_address: z.string().trim().max(1000).optional().nullable(),
  vendor_phone: z.string().trim().max(50).optional().nullable(),
  organization_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  bill_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  payment_terms: z.number().int().min(0).max(365).optional().nullable(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).default('USD'),
  exchange_rate: z.number().positive().default(1.0),
  notes: z.string().trim().max(2000).optional().nullable(),
  line_items: z.array(billLineItemSchema).min(1, 'At least 1 line item is required'),
}).superRefine((data, ctx) => {
  if (data.due_date < data.bill_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['due_date'],
      message: 'Due date cannot be before bill date',
    });
  }
});

// ============================================================
// Update Bill (draft only)
// ============================================================

export const updateBillSchema = z.object({
  vendor_name: z.string().trim().min(1).max(255).optional(),
  vendor_email: z.string().email().optional().nullable(),
  vendor_address: z.string().trim().max(1000).optional().nullable(),
  vendor_phone: z.string().trim().max(50).optional().nullable(),
  organization_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  bill_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  payment_terms: z.number().int().min(0).max(365).optional().nullable(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
  exchange_rate: z.number().positive().optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  line_items: z.array(billLineItemSchema).min(1).optional(),
}).superRefine((data, ctx) => {
  if (data.bill_date && data.due_date && data.due_date < data.bill_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['due_date'],
      message: 'Due date cannot be before bill date',
    });
  }
});

// ============================================================
// Bill Payment
// ============================================================

export const createBillPaymentSchema = z.object({
  bill_id: z.string().uuid(),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  amount: z.number().positive('Amount must be positive'),
  payment_method: z.enum(['cash', 'check', 'credit_card', 'bank_transfer', 'ach', 'wire', 'other']).optional().nullable(),
  reference: z.string().trim().max(255).optional().nullable(),
  account_id: z.string().uuid('Payment account is required'),
  notes: z.string().trim().max(2000).optional().nullable(),
});

// ============================================================
// Bill Statuses
// ============================================================

export const billStatuses = [
  'draft', 'received', 'partially_paid', 'paid', 'overdue', 'voided',
] as const;

import { z } from 'zod';

// ============================================================
// Bank Account
// ============================================================

export const bankAccountTypes = ['checking', 'savings', 'credit_card', 'other'] as const;

export const createBankAccountSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  institution: z.string().trim().max(255).optional().nullable(),
  account_number_last4: z.string().trim().regex(/^\d{1,4}$/, 'Last 4 digits must be numeric').optional().nullable(),
  account_type: z.enum(bankAccountTypes).default('checking'),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).default('USD'),
  current_balance: z.number().default(0),
  account_id: z.string().uuid('GL account is required').optional().nullable(),
  is_active: z.boolean().default(true),
});

export const updateBankAccountSchema = createBankAccountSchema
  .omit({ current_balance: true })
  .partial();

// ============================================================
// Bank Transaction
// ============================================================

export const transactionTypes = ['deposit', 'withdrawal', 'transfer', 'fee', 'interest'] as const;
export const importSources = ['manual', 'csv'] as const;

export const createBankTransactionSchema = z.object({
  bank_account_id: z.string().uuid(),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  description: z.string().trim().max(500).default(''),
  amount: z.number(),
  transaction_type: z.enum(transactionTypes).default('deposit'),
  reference: z.string().trim().max(255).optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.amount === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['amount'],
      message: 'Amount must be non-zero',
    });
  }

  if ((data.transaction_type === 'deposit' || data.transaction_type === 'interest') && data.amount < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['amount'],
      message: `${data.transaction_type} amount must be positive`,
    });
  }

  if ((data.transaction_type === 'withdrawal' || data.transaction_type === 'fee') && data.amount > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['amount'],
      message: `${data.transaction_type} amount must be negative`,
    });
  }
});

export const updateBankTransactionSchema = z.object({
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().trim().max(500).optional(),
  amount: z.number().optional(),
  transaction_type: z.enum(transactionTypes).optional(),
  reference: z.string().trim().max(255).optional().nullable(),
});

// ============================================================
// CSV Import
// ============================================================

export const csvColumnMappingSchema = z.object({
  date_column: z.string().min(1, 'Date column is required'),
  description_column: z.string().min(1, 'Description column is required'),
  amount_column: z.string().optional(),
  debit_column: z.string().optional(),
  credit_column: z.string().optional(),
  reference_column: z.string().optional(),
  date_format: z.string().default('YYYY-MM-DD'),
}).refine(
  (data) => data.amount_column || (data.debit_column && data.credit_column),
  { message: 'Either amount_column or both debit_column and credit_column are required' }
);

// ============================================================
// Reconciliation
// ============================================================

export const createReconciliationSchema = z.object({
  bank_account_id: z.string().uuid(),
  statement_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  statement_ending_balance: z.number(),
});

export const toggleReconciliationItemSchema = z.object({
  bank_transaction_id: z.string().uuid(),
});

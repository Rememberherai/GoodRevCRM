import { z } from 'zod';

// ============================================================
// Chart of Accounts
// ============================================================

export const accountTypes = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const;
export const normalBalances = ['debit', 'credit'] as const;

export const createAccountSchema = z.object({
  account_code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional(),
  account_type: z.enum(accountTypes),
  account_subtype: z.string().trim().max(50).optional(),
  parent_id: z.string().uuid().optional().nullable(),
  normal_balance: z.enum(normalBalances),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).default('USD'),
  is_active: z.boolean().default(true),
});

export const updateAccountSchema = createAccountSchema.partial();

// ============================================================
// Journal Entries
// ============================================================

export const jeSourceTypes = ['manual', 'invoice', 'bill', 'payment', 'adjustment', 'reversal'] as const;
export const jeStatuses = ['draft', 'posted', 'voided'] as const;

export const journalEntryLineSchema = z.object({
  account_id: z.string().uuid(),
  description: z.string().trim().max(500).optional(),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).default('USD'),
  exchange_rate: z.number().positive().default(1.0),
  organization_id: z.string().uuid().optional().nullable(),
});

export const createJournalEntrySchema = z.object({
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  memo: z.string().trim().max(1000).optional(),
  reference: z.string().trim().max(255).optional(),
  source_type: z.enum(jeSourceTypes).default('manual'),
  source_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional().nullable(),
  lines: z.array(journalEntryLineSchema).min(2, 'At least 2 lines required'),
});

export const updateJournalEntrySchema = z.object({
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  memo: z.string().trim().max(1000).optional(),
  reference: z.string().trim().max(255).optional(),
  project_id: z.string().uuid().optional().nullable(),
  lines: z.array(journalEntryLineSchema).min(2, 'At least 2 lines required').optional(),
});

// ============================================================
// Currency Rates
// ============================================================

export const createCurrencyRateSchema = z.object({
  from_currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  to_currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  rate: z.number().positive(),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
});

export const updateCurrencyRateSchema = createCurrencyRateSchema.partial();

// ============================================================
// Tax Rates
// ============================================================

export const createTaxRateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  rate: z.number().min(0).max(1), // 0.0825 = 8.25%
  description: z.string().trim().max(500).optional(),
  is_default: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export const updateTaxRateSchema = createTaxRateSchema.partial();

// ============================================================
// Settings
// ============================================================

export const updateSettingsSchema = z.object({
  default_payment_terms: z.number().int().min(0).max(365).optional(),
  invoice_notes: z.string().max(2000).optional().nullable(),
  invoice_footer: z.string().max(2000).optional().nullable(),
  default_revenue_account_id: z.string().uuid().optional().nullable(),
  default_expense_account_id: z.string().uuid().optional().nullable(),
  default_ar_account_id: z.string().uuid().optional().nullable(),
  default_ap_account_id: z.string().uuid().optional().nullable(),
  default_cash_account_id: z.string().uuid().optional().nullable(),
  default_tax_liability_account_id: z.string().uuid().optional().nullable(),
  default_fx_gain_loss_account_id: z.string().uuid().optional().nullable(),
});

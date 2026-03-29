import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { checkPermission } from '../auth';
import { getSignedBalance, hasMinRole } from '@/lib/accounting/helpers';
import type { McpContext } from '@/types/mcp';
import type { Database } from '@/types/database';

type AccountingRole = Database['public']['Enums']['accounting_role'];

interface AccountingCtx {
  companyId: string;
  accountingRole: AccountingRole;
}

/**
 * Get the user's accounting company ID and role, respecting their selected preference.
 * Falls back to oldest membership if no preference is set or it is invalid.
 * Returns null if user has no accounting company.
 */
async function getAccountingCtx(ctx: McpContext): Promise<AccountingCtx | null> {
  const { data: settings } = await ctx.supabase
    .from('user_settings')
    .select('selected_accounting_company_id')
    .eq('user_id', ctx.userId)
    .maybeSingle();

  const preferredId = settings?.selected_accounting_company_id ?? null;
  if (preferredId) {
    const { data: preferred } = await ctx.supabase
      .from('accounting_company_memberships')
      .select('company_id, role')
      .eq('user_id', ctx.userId)
      .eq('company_id', preferredId)
      .maybeSingle();
    if (preferred) return { companyId: preferred.company_id, accountingRole: preferred.role };
  }

  const { data } = await ctx.supabase
    .from('accounting_company_memberships')
    .select('company_id, role')
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { companyId: data.company_id, accountingRole: data.role };
}

// Backwards-compat shim used by read-only tools that only need the ID
async function getCompanyId(ctx: McpContext): Promise<string | null> {
  const result = await getAccountingCtx(ctx);
  return result?.companyId ?? null;
}

export function registerAccountingTools(server: McpServer, getContext: () => McpContext) {
  // accounting.list_accounts
  server.tool(
    'accounting.list_accounts',
    'List chart of accounts for the accounting company',
    {
      account_type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']).optional(),
      active_only: z.boolean().default(true),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');
      const companyId = await getCompanyId(ctx);
      if (!companyId) throw new Error('No accounting company found');

      let query = ctx.supabase
        .from('chart_of_accounts')
        .select('id, account_code, name, account_type, normal_balance, is_active, parent_id')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('account_code');

      if (params.account_type) query = query.eq('account_type', params.account_type);
      if (params.active_only) query = query.eq('is_active', true);

      const { data, error } = await query;
      if (error) throw new Error(`Failed to list accounts: ${error.message}`);

      return { content: [{ type: 'text' as const, text: JSON.stringify(data ?? []) }] };
    },
  );

  // accounting.list_invoices
  server.tool(
    'accounting.list_invoices',
    'List invoices for the accounting company',
    {
      status: z.enum(['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'voided']).optional(),
      limit: z.number().int().min(1).max(100).default(50),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');
      const companyId = await getCompanyId(ctx);
      if (!companyId) throw new Error('No accounting company found');

      let query = ctx.supabase
        .from('invoices')
        .select('id, invoice_number, customer_name, invoice_date, due_date, status, total, balance_due, currency')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('invoice_date', { ascending: false })
        .limit(params.limit);

      if (params.status) query = query.eq('status', params.status);

      const { data, error } = await query;
      if (error) throw new Error(`Failed to list invoices: ${error.message}`);

      return { content: [{ type: 'text' as const, text: JSON.stringify(data ?? []) }] };
    },
  );

  // accounting.list_bills
  server.tool(
    'accounting.list_bills',
    'List bills for the accounting company',
    {
      status: z.enum(['draft', 'received', 'partially_paid', 'paid', 'overdue', 'voided']).optional(),
      limit: z.number().int().min(1).max(100).default(50),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');
      const companyId = await getCompanyId(ctx);
      if (!companyId) throw new Error('No accounting company found');

      let query = ctx.supabase
        .from('bills')
        .select('id, bill_number, vendor_name, bill_date, due_date, status, total, balance_due, currency')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('bill_date', { ascending: false })
        .limit(params.limit);

      if (params.status) query = query.eq('status', params.status);

      const { data, error } = await query;
      if (error) throw new Error(`Failed to list bills: ${error.message}`);

      return { content: [{ type: 'text' as const, text: JSON.stringify(data ?? []) }] };
    },
  );

  // accounting.list_journal_entries
  server.tool(
    'accounting.list_journal_entries',
    'List journal entries for the accounting company',
    {
      status: z.enum(['draft', 'posted', 'voided']).optional(),
      limit: z.number().int().min(1).max(100).default(50),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');
      const companyId = await getCompanyId(ctx);
      if (!companyId) throw new Error('No accounting company found');

      let query = ctx.supabase
        .from('journal_entries')
        .select('id, entry_number, entry_date, memo, source_type, status')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('entry_date', { ascending: false })
        .limit(params.limit);

      if (params.status) query = query.eq('status', params.status);

      const { data, error } = await query;
      if (error) throw new Error(`Failed to list journal entries: ${error.message}`);

      return { content: [{ type: 'text' as const, text: JSON.stringify(data ?? []) }] };
    },
  );

  // accounting.get_invoice
  server.tool(
    'accounting.get_invoice',
    'Get details of a specific invoice including line items',
    {
      invoice_id: z.string().uuid(),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');
      const companyId = await getCompanyId(ctx);
      if (!companyId) throw new Error('No accounting company found');

      const { data: invoice, error } = await ctx.supabase
        .from('invoices')
        .select('*, invoice_line_items(*)')
        .eq('id', params.invoice_id)
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .single();

      if (error) throw new Error(`Failed to get invoice: ${error.message}`);

      return { content: [{ type: 'text' as const, text: JSON.stringify(invoice) }] };
    },
  );

  // accounting.record_payment
  server.tool(
    'accounting.record_payment',
    'Record a payment received against an invoice',
    {
      invoice_id: z.string().uuid(),
      account_id: z.string().uuid().describe('Cash or bank account ID to receive the payment'),
      amount: z.number().positive(),
      payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      payment_method: z.enum(['cash', 'check', 'credit_card', 'bank_transfer', 'ach', 'wire', 'other']).optional(),
      reference: z.string().optional(),
      notes: z.string().optional(),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');
      const acctCtx = await getAccountingCtx(ctx);
      if (!acctCtx) throw new Error('No accounting company found');
      if (!hasMinRole(acctCtx.accountingRole, 'member')) throw new Error('Insufficient accounting permissions');

      // BUG-L fix: pass undefined (not empty string) for optional params
      const { data, error } = await ctx.supabase.rpc('record_invoice_payment', {
        p_account_id: params.account_id,
        p_invoice_id: params.invoice_id,
        p_amount: params.amount,
        p_payment_date: params.payment_date,
        p_payment_method: params.payment_method ?? undefined,
        p_reference: params.reference ?? undefined,
        p_notes: params.notes ?? undefined,
      });

      if (error) throw new Error(`Failed to record payment: ${error.message}`);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: true, payment_id: data }) }],
      };
    },
  );

  // accounting.list_recurring
  server.tool(
    'accounting.list_recurring',
    'List recurring transactions (scheduled invoices/bills)',
    {
      active_only: z.boolean().default(true),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');
      const companyId = await getCompanyId(ctx);
      if (!companyId) throw new Error('No accounting company found');

      let query = ctx.supabase
        .from('recurring_transactions')
        .select('id, name, type, counterparty_name, frequency, next_date, is_active, total_generated')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('next_date');

      if (params.active_only) query = query.eq('is_active', true);

      const { data, error } = await query;
      if (error) throw new Error(`Failed to list recurring transactions: ${error.message}`);

      return { content: [{ type: 'text' as const, text: JSON.stringify(data ?? []) }] };
    },
  );

  // accounting.report_trial_balance
  server.tool(
    'accounting.report_trial_balance',
    'Get trial balance report showing account balances',
    {
      as_of_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');
      const companyId = await getCompanyId(ctx);
      if (!companyId) throw new Error('No accounting company found');

      // Query journal entry lines directly instead of via HTTP
      let query = ctx.supabase
        .from('journal_entry_lines')
        .select('account_id, base_debit, base_credit, journal_entries!inner(company_id, status, entry_date, deleted_at)')
        .eq('journal_entries.company_id', companyId)
        .eq('journal_entries.status', 'posted')
        .is('journal_entries.deleted_at', null);

      if (params.as_of_date) {
        query = query.lte('journal_entries.entry_date', params.as_of_date);
      }

      const { data: lines, error: linesError } = await query;

      const { data: accounts, error: accountsError } = await ctx.supabase
        .from('chart_of_accounts')
        .select('id, account_code, name, account_type, normal_balance')
        .eq('company_id', companyId)
        .order('account_code');

      if (linesError || accountsError) throw new Error('Failed to fetch trial balance data');

      const accountTotals = new Map<string, { debitCents: number; creditCents: number }>();
      for (const line of lines ?? []) {
        const existing = accountTotals.get(line.account_id) ?? { debitCents: 0, creditCents: 0 };
        existing.debitCents += Math.round(Number(line.base_debit) * 100);
        existing.creditCents += Math.round(Number(line.base_credit) * 100);
        accountTotals.set(line.account_id, existing);
      }

      const trialBalance = (accounts ?? []).map((a) => {
        const totals = accountTotals.get(a.id) ?? { debitCents: 0, creditCents: 0 };
        return {
          account_code: a.account_code,
          account_name: a.name,
          account_type: a.account_type,
          total_debit: totals.debitCents / 100,
          total_credit: totals.creditCents / 100,
          balance: getSignedBalance(
            a.normal_balance,
            totals.debitCents / 100,
            totals.creditCents / 100,
          ),
        };
      }).filter((row) => row.total_debit !== 0 || row.total_credit !== 0);

      return { content: [{ type: 'text' as const, text: JSON.stringify(trialBalance) }] };
    },
  );
}

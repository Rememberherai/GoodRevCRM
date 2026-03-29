import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

interface ReportFilters {
  companyId: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD (or as_of_date for point-in-time reports)
  projectId?: string;
}

/** Integer-cent math to avoid floating-point drift */
function toCents(v: unknown): number {
  return Math.round(Number(v ?? 0) * 100);
}
function fromCents(v: number): number {
  return v / 100;
}
function todayStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function dateOnlyToUtcMs(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1);
}
function balanceDeltaCents(
  normalBalance: string,
  debit: unknown,
  credit: unknown,
): number {
  const debitCents = toCents(debit);
  const creditCents = toCents(credit);
  return normalBalance === 'credit'
    ? creditCents - debitCents
    : debitCents - creditCents;
}

// ---------------------------------------------------------------------------
// Profit & Loss (Income Statement)
// ---------------------------------------------------------------------------

export interface ProfitLossRow {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: 'revenue' | 'expense';
  account_subtype: string | null;
  total: number; // positive = income, positive = expense
}

export interface ProfitLossReport {
  revenue: ProfitLossRow[];
  expenses: ProfitLossRow[];
  total_revenue: number;
  total_expenses: number;
  net_income: number;
  start_date: string;
  end_date: string;
}

export async function generateProfitAndLoss(
  supabase: SupabaseClient<Database>,
  filters: ReportFilters,
): Promise<ProfitLossReport> {
  const { companyId, startDate, endDate, projectId } = filters;

  // Fetch posted JE lines for revenue & expense accounts in date range
  let query = supabase
    .from('journal_entry_lines')
    .select(
      'account_id, base_debit, base_credit, journal_entries!inner(company_id, status, entry_date, deleted_at, project_id)',
    )
    .eq('journal_entries.company_id', companyId)
    .eq('journal_entries.status', 'posted')
    .is('journal_entries.deleted_at', null);

  if (startDate) query = query.gte('journal_entries.entry_date', startDate);
  if (endDate) query = query.lte('journal_entries.entry_date', endDate);
  if (projectId) query = query.eq('journal_entries.project_id', projectId);

  const [{ data: lines, error: linesErr }, { data: accounts, error: acctErr }] =
    await Promise.all([
      query,
      supabase
        .from('chart_of_accounts')
        .select('id, account_code, name, account_type, account_subtype, normal_balance')
        .eq('company_id', companyId)
        .in('account_type', ['revenue', 'expense'])
        .order('account_code'),
    ]);

  if (linesErr || acctErr) {
    throw new Error(`P&L query failed: ${linesErr?.message || acctErr?.message}`);
  }

  const accountMap = new Map(
    (accounts ?? []).map((a) => [a.id, a]),
  );

  // Aggregate by account
  const totals = new Map<string, number>();
  for (const line of lines ?? []) {
    if (!accountMap.has(line.account_id)) continue;
    const prev = totals.get(line.account_id) ?? 0;
    const acct = accountMap.get(line.account_id)!;
    // Revenue: normal_balance = credit, so amount = credit - debit
    // Expense: normal_balance = debit, so amount = debit - credit
    if (acct.normal_balance === 'credit') {
      totals.set(line.account_id, prev + toCents(line.base_credit) - toCents(line.base_debit));
    } else {
      totals.set(line.account_id, prev + toCents(line.base_debit) - toCents(line.base_credit));
    }
  }

  const revenue: ProfitLossRow[] = [];
  const expenses: ProfitLossRow[] = [];
  let totalRevenueCents = 0;
  let totalExpensesCents = 0;

  for (const acct of accounts ?? []) {
    const amountCents = totals.get(acct.id) ?? 0;
    if (amountCents === 0) continue;
    const row: ProfitLossRow = {
      account_id: acct.id,
      account_code: acct.account_code,
      account_name: acct.name,
      account_type: acct.account_type as 'revenue' | 'expense',
      account_subtype: acct.account_subtype,
      total: fromCents(amountCents),
    };
    if (acct.account_type === 'revenue') {
      revenue.push(row);
      totalRevenueCents += amountCents;
    } else {
      expenses.push(row);
      totalExpensesCents += amountCents;
    }
  }

  return {
    revenue,
    expenses,
    total_revenue: fromCents(totalRevenueCents),
    total_expenses: fromCents(totalExpensesCents),
    net_income: fromCents(totalRevenueCents - totalExpensesCents),
    start_date: startDate ?? '',
    end_date: endDate ?? todayStr(),
  };
}

// ---------------------------------------------------------------------------
// Balance Sheet
// ---------------------------------------------------------------------------

export interface BalanceSheetRow {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: 'asset' | 'liability' | 'equity';
  account_subtype: string | null;
  balance: number;
}

export interface BalanceSheetReport {
  assets: BalanceSheetRow[];
  liabilities: BalanceSheetRow[];
  equity: BalanceSheetRow[];
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  retained_earnings: number;
  as_of_date: string;
}

export async function generateBalanceSheet(
  supabase: SupabaseClient<Database>,
  filters: ReportFilters,
): Promise<BalanceSheetReport> {
  const { companyId, endDate: asOfDate, projectId } = filters;

  let query = supabase
    .from('journal_entry_lines')
    .select(
      'account_id, base_debit, base_credit, journal_entries!inner(company_id, status, entry_date, deleted_at, project_id)',
    )
    .eq('journal_entries.company_id', companyId)
    .eq('journal_entries.status', 'posted')
    .is('journal_entries.deleted_at', null);

  if (asOfDate) query = query.lte('journal_entries.entry_date', asOfDate);
  if (projectId) query = query.eq('journal_entries.project_id', projectId);

  const [{ data: lines, error: linesErr }, { data: accounts, error: acctErr }] =
    await Promise.all([
      query,
      supabase
        .from('chart_of_accounts')
        .select('id, account_code, name, account_type, account_subtype, normal_balance')
        .eq('company_id', companyId)
        .order('account_code'),
    ]);

  if (linesErr || acctErr) {
    throw new Error(`Balance sheet query failed: ${linesErr?.message || acctErr?.message}`);
  }

  const accountMap = new Map(
    (accounts ?? []).map((a) => [a.id, a]),
  );

  // Aggregate by account
  const balances = new Map<string, number>();
  for (const line of lines ?? []) {
    const acct = accountMap.get(line.account_id);
    if (!acct) continue;
    const prev = balances.get(line.account_id) ?? 0;
    if (acct.normal_balance === 'debit') {
      balances.set(line.account_id, prev + toCents(line.base_debit) - toCents(line.base_credit));
    } else {
      balances.set(line.account_id, prev + toCents(line.base_credit) - toCents(line.base_debit));
    }
  }

  const assets: BalanceSheetRow[] = [];
  const liabilities: BalanceSheetRow[] = [];
  const equity: BalanceSheetRow[] = [];
  let totalAssetsCents = 0;
  let totalLiabilitiesCents = 0;
  let totalEquityCents = 0;
  let retainedEarningsCents = 0;

  for (const acct of accounts ?? []) {
    const balCents = balances.get(acct.id) ?? 0;

    if (acct.account_type === 'revenue' || acct.account_type === 'expense') {
      // Revenue/expense roll into retained earnings
      if (acct.account_type === 'revenue') {
        retainedEarningsCents += balCents;
      } else {
        retainedEarningsCents -= balCents;
      }
      continue;
    }

    if (balCents === 0) continue;

    const row: BalanceSheetRow = {
      account_id: acct.id,
      account_code: acct.account_code,
      account_name: acct.name,
      account_type: acct.account_type as 'asset' | 'liability' | 'equity',
      account_subtype: acct.account_subtype,
      balance: fromCents(balCents),
    };

    switch (acct.account_type) {
      case 'asset':
        assets.push(row);
        totalAssetsCents += balCents;
        break;
      case 'liability':
        liabilities.push(row);
        totalLiabilitiesCents += balCents;
        break;
      case 'equity':
        equity.push(row);
        totalEquityCents += balCents;
        break;
    }
  }

  // Add retained earnings to equity
  totalEquityCents += retainedEarningsCents;

  const today = todayStr();
  return {
    assets,
    liabilities,
    equity,
    total_assets: fromCents(totalAssetsCents),
    total_liabilities: fromCents(totalLiabilitiesCents),
    total_equity: fromCents(totalEquityCents),
    retained_earnings: fromCents(retainedEarningsCents),
    as_of_date: asOfDate ?? today,
  };
}

// ---------------------------------------------------------------------------
// General Ledger
// ---------------------------------------------------------------------------

export interface GeneralLedgerEntry {
  entry_date: string;
  entry_number: number;
  memo: string | null;
  description: string | null;
  debit: number;
  credit: number;
  running_balance: number;
  journal_entry_id: string;
}

export interface GeneralLedgerAccount {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  normal_balance: string;
  opening_balance: number;
  entries: GeneralLedgerEntry[];
  closing_balance: number;
}

export interface GeneralLedgerReport {
  accounts: GeneralLedgerAccount[];
  start_date: string;
  end_date: string;
}

export async function generateGeneralLedger(
  supabase: SupabaseClient<Database>,
  filters: ReportFilters & { accountId?: string },
): Promise<GeneralLedgerReport> {
  const { companyId, startDate, endDate, projectId, accountId } = filters;

  // Fetch accounts
  let acctQuery = supabase
    .from('chart_of_accounts')
    .select('id, account_code, name, account_type, normal_balance')
    .eq('company_id', companyId)
    .order('account_code');

  if (accountId) acctQuery = acctQuery.eq('id', accountId);

  const { data: accounts, error: acctErr } = await acctQuery;
  if (acctErr) throw new Error(`GL accounts query failed: ${acctErr.message}`);

  const accountIds = (accounts ?? []).map((a) => a.id);
  const accountMap = new Map((accounts ?? []).map((a) => [a.id, a]));
  if (accountIds.length === 0) {
    return { accounts: [], start_date: startDate ?? '', end_date: endDate ?? '' };
  }

  // Fetch opening balances (all posted lines before startDate)
  const openingBalances = new Map<string, number>();
  if (startDate) {
    let priorQuery = supabase
      .from('journal_entry_lines')
      .select(
        'account_id, base_debit, base_credit, journal_entries!inner(company_id, status, entry_date, deleted_at, project_id)',
      )
      .eq('journal_entries.company_id', companyId)
      .eq('journal_entries.status', 'posted')
      .is('journal_entries.deleted_at', null)
      .lt('journal_entries.entry_date', startDate)
      .in('account_id', accountIds);

    if (projectId) priorQuery = priorQuery.eq('journal_entries.project_id', projectId);

    const { data: priorLines, error: priorErr } = await priorQuery;

    if (priorErr) throw new Error(`GL prior lines query failed: ${priorErr.message}`);

    for (const line of priorLines ?? []) {
      const prev = openingBalances.get(line.account_id) ?? 0;
      const acct = accountMap.get(line.account_id);
      if (!acct) continue;
      openingBalances.set(
        line.account_id,
        prev + balanceDeltaCents(acct.normal_balance, line.base_debit, line.base_credit),
      );
    }
  }

  // Fetch lines in date range
  let lineQuery = supabase
    .from('journal_entry_lines')
    .select(
      'account_id, base_debit, base_credit, description, journal_entry_id, journal_entries!inner(company_id, status, entry_date, entry_number, memo, deleted_at, project_id)',
    )
    .eq('journal_entries.company_id', companyId)
    .eq('journal_entries.status', 'posted')
    .is('journal_entries.deleted_at', null)
    .in('account_id', accountIds);

  if (startDate) lineQuery = lineQuery.gte('journal_entries.entry_date', startDate);
  if (endDate) lineQuery = lineQuery.lte('journal_entries.entry_date', endDate);
  if (projectId) lineQuery = lineQuery.eq('journal_entries.project_id', projectId);

  const { data: lines, error: linesErr } = await lineQuery;
  if (linesErr) throw new Error(`GL lines query failed: ${linesErr.message}`);

  // Group lines by account, sort by date + entry_number
  const linesByAccount = new Map<string, typeof lines>();
  for (const line of lines ?? []) {
    const existing = linesByAccount.get(line.account_id) ?? [];
    existing.push(line);
    linesByAccount.set(line.account_id, existing);
  }

  const result: GeneralLedgerAccount[] = [];
  for (const acct of accounts ?? []) {
    const acctLines = linesByAccount.get(acct.id) ?? [];
    if (acctLines.length === 0 && !openingBalances.has(acct.id)) continue;

    // Sort by date then entry number
    acctLines.sort((a, b) => {
      const je_a = a.journal_entries as unknown as { entry_date: string; entry_number: number };
      const je_b = b.journal_entries as unknown as { entry_date: string; entry_number: number };
      const dateCmp = je_a.entry_date.localeCompare(je_b.entry_date);
      if (dateCmp !== 0) return dateCmp;
      return je_a.entry_number - je_b.entry_number;
    });

    const openCents = openingBalances.get(acct.id) ?? 0;
    let runningCents = openCents;

    const entries: GeneralLedgerEntry[] = acctLines.map((line) => {
      const je = line.journal_entries as unknown as {
        entry_date: string;
        entry_number: number;
        memo: string | null;
      };
      const debitCents = toCents(line.base_debit);
      const creditCents = toCents(line.base_credit);
      runningCents += balanceDeltaCents(acct.normal_balance, line.base_debit, line.base_credit);

      return {
        entry_date: je.entry_date,
        entry_number: je.entry_number,
        memo: je.memo,
        description: line.description,
        debit: fromCents(debitCents),
        credit: fromCents(creditCents),
        running_balance: fromCents(runningCents),
        journal_entry_id: line.journal_entry_id,
      };
    });

    result.push({
      account_id: acct.id,
      account_code: acct.account_code,
      account_name: acct.name,
      account_type: acct.account_type,
      normal_balance: acct.normal_balance,
      opening_balance: fromCents(openCents),
      entries,
      closing_balance: fromCents(runningCents),
    });
  }

  const today = todayStr();
  return {
    accounts: result,
    start_date: startDate ?? '',
    end_date: endDate ?? today,
  };
}

// ---------------------------------------------------------------------------
// AR Aging
// ---------------------------------------------------------------------------

export interface AgingBucket {
  label: string;
  amount: number;
  count: number;
}

export interface AgingRow {
  id: string;
  number: string;
  counterparty_name: string;
  date: string;
  due_date: string;
  total: number;
  balance_due: number;
  days_past_due: number;
  bucket: string;
  organization_id: string | null;
}

export interface AgingReport {
  rows: AgingRow[];
  buckets: AgingBucket[];
  total_outstanding: number;
  as_of_date: string;
  type: 'ar' | 'ap';
}

const BUCKET_RANGES = [
  { label: 'Current', min: -Infinity, max: 0 },
  { label: '1-30', min: 1, max: 30 },
  { label: '31-60', min: 31, max: 60 },
  { label: '61-90', min: 61, max: 90 },
  { label: '90+', min: 91, max: Infinity },
];

function getBucketLabel(daysPastDue: number): string {
  for (const b of BUCKET_RANGES) {
    if (daysPastDue >= b.min && daysPastDue <= b.max) return b.label;
  }
  return '90+';
}

export async function generateARaging(
  supabase: SupabaseClient<Database>,
  companyId: string,
  asOfDate?: string,
): Promise<AgingReport> {
  const today = asOfDate ?? todayStr();

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, customer_name, invoice_date, due_date, total, balance_due, organization_id')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .in('status', ['sent', 'partially_paid', 'overdue'])
    .gt('balance_due', 0);

  if (error) throw new Error(`AR aging query failed: ${error.message}`);

  const rows: AgingRow[] = [];
  const bucketTotals = new Map<string, { amount: number; count: number }>();
  BUCKET_RANGES.forEach((b) => bucketTotals.set(b.label, { amount: 0, count: 0 }));

  let totalOutstanding = 0;

  for (const inv of invoices ?? []) {
    const dueDateMs = dateOnlyToUtcMs(inv.due_date);
    const refDateMs = dateOnlyToUtcMs(today);
    const daysPastDue = Math.floor((refDateMs - dueDateMs) / (1000 * 60 * 60 * 24));
    const bucket = getBucketLabel(daysPastDue);
    const balanceCents = toCents(inv.balance_due);

    rows.push({
      id: inv.id,
      number: inv.invoice_number,
      counterparty_name: inv.customer_name,
      date: inv.invoice_date,
      due_date: inv.due_date,
      total: Number(inv.total),
      balance_due: Number(inv.balance_due),
      days_past_due: Math.max(0, daysPastDue),
      bucket,
      organization_id: inv.organization_id,
    });

    const bt = bucketTotals.get(bucket)!;
    bt.amount += balanceCents;
    bt.count += 1;
    totalOutstanding += balanceCents;
  }

  rows.sort((a, b) => b.days_past_due - a.days_past_due);

  const buckets: AgingBucket[] = BUCKET_RANGES.map((b) => {
    const t = bucketTotals.get(b.label)!;
    return { label: b.label, amount: fromCents(t.amount), count: t.count };
  });

  return {
    rows,
    buckets,
    total_outstanding: fromCents(totalOutstanding),
    as_of_date: today,
    type: 'ar',
  };
}

// ---------------------------------------------------------------------------
// AP Aging
// ---------------------------------------------------------------------------

export async function generateAPaging(
  supabase: SupabaseClient<Database>,
  companyId: string,
  asOfDate?: string,
): Promise<AgingReport> {
  const today = asOfDate ?? todayStr();

  const { data: bills, error } = await supabase
    .from('bills')
    .select('id, bill_number, vendor_name, bill_date, due_date, total, balance_due, organization_id')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .in('status', ['received', 'partially_paid', 'overdue'])
    .gt('balance_due', 0);

  if (error) throw new Error(`AP aging query failed: ${error.message}`);

  const rows: AgingRow[] = [];
  const bucketTotals = new Map<string, { amount: number; count: number }>();
  BUCKET_RANGES.forEach((b) => bucketTotals.set(b.label, { amount: 0, count: 0 }));

  let totalOutstanding = 0;

  for (const bill of bills ?? []) {
    const dueDateMs = dateOnlyToUtcMs(bill.due_date);
    const refDateMs = dateOnlyToUtcMs(today);
    const daysPastDue = Math.floor((refDateMs - dueDateMs) / (1000 * 60 * 60 * 24));
    const bucket = getBucketLabel(daysPastDue);
    const balanceCents = toCents(bill.balance_due);

    rows.push({
      id: bill.id,
      number: bill.bill_number,
      counterparty_name: bill.vendor_name,
      date: bill.bill_date,
      due_date: bill.due_date,
      total: Number(bill.total),
      balance_due: Number(bill.balance_due),
      days_past_due: Math.max(0, daysPastDue),
      bucket,
      organization_id: bill.organization_id,
    });

    const bt = bucketTotals.get(bucket)!;
    bt.amount += balanceCents;
    bt.count += 1;
    totalOutstanding += balanceCents;
  }

  rows.sort((a, b) => b.days_past_due - a.days_past_due);

  const buckets: AgingBucket[] = BUCKET_RANGES.map((b) => {
    const t = bucketTotals.get(b.label)!;
    return { label: b.label, amount: fromCents(t.amount), count: t.count };
  });

  return {
    rows,
    buckets,
    total_outstanding: fromCents(totalOutstanding),
    as_of_date: today,
    type: 'ap',
  };
}

// ---------------------------------------------------------------------------
// Cash Flow Statement
// ---------------------------------------------------------------------------

export interface CashFlowCategory {
  label: string;
  items: { account_name: string; amount: number }[];
  total: number;
}

export interface CashFlowReport {
  operating: CashFlowCategory;
  investing: CashFlowCategory;
  financing: CashFlowCategory;
  net_change: number;
  opening_cash: number;
  closing_cash: number;
  start_date: string;
  end_date: string;
}

const INVESTING_SUBTYPES = new Set(['fixed_asset', 'equipment', 'long_term_investment']);
const FINANCING_SUBTYPES = new Set(['long_term_debt', 'equity', 'owners_draw', 'retained_earnings']);

export async function generateCashFlow(
  supabase: SupabaseClient<Database>,
  filters: ReportFilters,
): Promise<CashFlowReport> {
  const { companyId, startDate, endDate, projectId } = filters;

  // Get all accounts
  const { data: accounts, error: acctErr } = await supabase
    .from('chart_of_accounts')
    .select('id, account_code, name, account_type, account_subtype, normal_balance')
    .eq('company_id', companyId)
    .order('account_code');

  if (acctErr) throw new Error(`Cash flow accounts query failed: ${acctErr.message}`);

  const accountMap = new Map((accounts ?? []).map((a) => [a.id, a]));
  const cashAccountIds = (accounts ?? [])
    .filter((a) => a.account_type === 'asset' && (a.account_subtype === 'cash' || a.account_subtype === 'bank'))
    .map((a) => a.id);

  // Get opening cash balance (lines before startDate on cash accounts)
  let openingCashCents = 0;
  if (startDate && cashAccountIds.length > 0) {
    let priorQuery = supabase
      .from('journal_entry_lines')
      .select(
        'account_id, base_debit, base_credit, journal_entries!inner(company_id, status, entry_date, deleted_at, project_id)',
      )
      .eq('journal_entries.company_id', companyId)
      .eq('journal_entries.status', 'posted')
      .is('journal_entries.deleted_at', null)
      .lt('journal_entries.entry_date', startDate)
      .in('account_id', cashAccountIds);

    if (projectId) priorQuery = priorQuery.eq('journal_entries.project_id', projectId);

    const { data: priorLines, error: priorErr } = await priorQuery;
    if (priorErr) throw new Error(`Cash flow opening balance query failed: ${priorErr.message}`);

    for (const line of priorLines ?? []) {
      openingCashCents += toCents(line.base_debit) - toCents(line.base_credit);
    }
  }

  // Get all posted lines in date range
  let lineQuery = supabase
    .from('journal_entry_lines')
    .select(
      'account_id, base_debit, base_credit, journal_entry_id, journal_entries!inner(company_id, status, entry_date, deleted_at, project_id)',
    )
    .eq('journal_entries.company_id', companyId)
    .eq('journal_entries.status', 'posted')
    .is('journal_entries.deleted_at', null);

  if (startDate) lineQuery = lineQuery.gte('journal_entries.entry_date', startDate);
  if (endDate) lineQuery = lineQuery.lte('journal_entries.entry_date', endDate);
  if (projectId) lineQuery = lineQuery.eq('journal_entries.project_id', projectId);

  const { data: lines, error: linesErr } = await lineQuery;
  if (linesErr) throw new Error(`Cash flow lines query failed: ${linesErr.message}`);

  // Only entries that touch a cash account belong on the cash-flow statement.
  // Group by journal entry so accrual-only journal entries do not leak into cash flow.
  const linesByEntry = new Map<string, typeof lines>();
  for (const line of lines ?? []) {
    const existing = linesByEntry.get(line.journal_entry_id) ?? [];
    existing.push(line);
    linesByEntry.set(line.journal_entry_id, existing);
  }

  const netByAccount = new Map<string, number>();
  let totalCashChangeCents = 0;

  for (const entryLines of linesByEntry.values()) {
    const hasCashMovement = entryLines.some((line) => cashAccountIds.includes(line.account_id));
    if (!hasCashMovement) continue;

    for (const line of entryLines) {
      const acct = accountMap.get(line.account_id);
      if (!acct) continue;

      const isCash = cashAccountIds.includes(line.account_id);
      if (isCash) {
        totalCashChangeCents += toCents(line.base_debit) - toCents(line.base_credit);
        continue;
      }

      const prev = netByAccount.get(line.account_id) ?? 0;
      netByAccount.set(line.account_id, prev + toCents(line.base_credit) - toCents(line.base_debit));
    }
  }

  // Categorize by operating/investing/financing
  const operating: { account_name: string; amount: number }[] = [];
  const investing: { account_name: string; amount: number }[] = [];
  const financing: { account_name: string; amount: number }[] = [];
  let opTotal = 0, invTotal = 0, finTotal = 0;

  for (const [acctId, amountCents] of netByAccount) {
    if (amountCents === 0) continue;
    const acct = accountMap.get(acctId);
    if (!acct) continue;

    const item = { account_name: acct.name, amount: fromCents(amountCents) };
    const subtype = acct.account_subtype ?? '';

    if (FINANCING_SUBTYPES.has(subtype) || acct.account_type === 'equity') {
      financing.push(item);
      finTotal += amountCents;
    } else if (INVESTING_SUBTYPES.has(subtype)) {
      investing.push(item);
      invTotal += amountCents;
    } else {
      operating.push(item);
      opTotal += amountCents;
    }
  }

  // BUG-P fix: derive net_change from the sum of category totals so it is always consistent.
  // totalCashChangeCents (Track 1) can diverge from opTotal+invTotal+finTotal (Track 2) when
  // a non-cash account in a cash-touching JE is missing from accountMap. Using the category
  // sum guarantees net_change == operating.total + investing.total + financing.total.
  const netChangeCents = opTotal + invTotal + finTotal;
  const today = todayStr();
  return {
    operating: { label: 'Operating Activities', items: operating, total: fromCents(opTotal) },
    investing: { label: 'Investing Activities', items: investing, total: fromCents(invTotal) },
    financing: { label: 'Financing Activities', items: financing, total: fromCents(finTotal) },
    net_change: fromCents(netChangeCents),
    opening_cash: fromCents(openingCashCents),
    closing_cash: fromCents(openingCashCents + netChangeCents),
    start_date: startDate ?? '',
    end_date: endDate ?? today,
  };
}

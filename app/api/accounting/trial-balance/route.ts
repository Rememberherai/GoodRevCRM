import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getAccountingContext } from '@/lib/accounting/helpers';
import { asOfDateQuerySchema, getLocalTodayString, parseQuery } from '@/lib/accounting/report-query';
import { z } from 'zod';

// GET /api/accounting/trial-balance
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const { as_of_date: asOfDate, project_id: projectId } = parseQuery(
      searchParams,
      asOfDateQuerySchema,
    );

    // Fetch all lines joined to their parent journal entries in a single query.
    // Filter to posted entries for this company, optionally by date and project.
    let query = supabase
      .from('journal_entry_lines')
      .select('account_id, base_debit, base_credit, journal_entries!inner(company_id, status, entry_date, deleted_at, project_id)')
      .eq('journal_entries.company_id', ctx.companyId)
      .eq('journal_entries.status', 'posted')
      .is('journal_entries.deleted_at', null);

    if (asOfDate) {
      query = query.lte('journal_entries.entry_date', asOfDate);
    }
    if (projectId) {
      query = query.eq('journal_entries.project_id', projectId);
    }

    const { data: lines, error: linesError } = await query;

    // Fetch all company accounts, including inactive/soft-deleted ones, so historical
    // balances still appear after an account is retired.
    const { data: accounts, error: accountsError } = await supabase
      .from('chart_of_accounts')
      .select('id, account_code, name, account_type, account_subtype, normal_balance')
      .eq('company_id', ctx.companyId)
      .order('account_code');

    if (linesError || accountsError) {
      console.error('Error generating trial balance:', linesError || accountsError);
      return NextResponse.json({ error: 'Failed to generate trial balance' }, { status: 500 });
    }

    // Aggregate by account using integer cents to avoid floating-point drift
    const accountTotals = new Map<string, { debitCents: number; creditCents: number }>();
    for (const line of lines ?? []) {
      const existing = accountTotals.get(line.account_id) ?? { debitCents: 0, creditCents: 0 };
      existing.debitCents += Math.round(Number(line.base_debit) * 100);
      existing.creditCents += Math.round(Number(line.base_credit) * 100);
      accountTotals.set(line.account_id, existing);
    }

    let totalDebitCents = 0;
    let totalCreditCents = 0;

    const trialBalance = (accounts ?? []).map((a) => {
      const totals = accountTotals.get(a.id) ?? { debitCents: 0, creditCents: 0 };
      totalDebitCents += totals.debitCents;
      totalCreditCents += totals.creditCents;

      return {
        account_id: a.id,
        account_code: a.account_code,
        account_name: a.name,
        account_type: a.account_type,
        account_subtype: a.account_subtype,
        normal_balance: a.normal_balance,
        total_debit: totals.debitCents / 100,
        total_credit: totals.creditCents / 100,
        balance: (totals.debitCents - totals.creditCents) / 100,
      };
    }).filter((row) => row.total_debit !== 0 || row.total_credit !== 0);

    return NextResponse.json({
      data: trialBalance,
      as_of_date: asOfDate ?? getLocalTodayString(),
      totals: {
        total_debit: totalDebitCents / 100,
        total_credit: totalCreditCents / 100,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query parameters', details: error.issues }, { status: 400 });
    }
    console.error('Error generating trial balance:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

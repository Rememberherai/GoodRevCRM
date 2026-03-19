import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toggleReconciliationItemSchema } from '@/lib/validators/bank';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/accounting/reconciliations/[id]/items
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id: reconciliationId } = await context.params;
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch reconciliation with its items
    const { data: recon, error: reconError } = await supabase
      .from('reconciliations')
      .select('*, bank_accounts(id, name, current_balance, currency)')
      .eq('id', reconciliationId)
      .eq('company_id', ctx.companyId)
      .single();

    if (reconError || !recon) {
      return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 });
    }

    // Get selected item IDs
    const { data: items, error: itemsError } = await supabase
      .from('reconciliation_items')
      .select('bank_transaction_id')
      .eq('reconciliation_id', reconciliationId);

    if (itemsError) {
      return NextResponse.json({ error: 'Failed to load reconciliation items' }, { status: 500 });
    }

    const selectedIds = new Set((items ?? []).map((i) => i.bank_transaction_id));

    // Get all unreconciled transactions for this bank account (+ any already selected)
    const { data: transactions, error: transactionsError } = await supabase
      .from('bank_transactions')
      .select('*')
      .eq('bank_account_id', recon.bank_account_id)
      .eq('company_id', ctx.companyId)
      .lte('transaction_date', recon.statement_date)
      .order('transaction_date', { ascending: true });

    if (transactionsError) {
      return NextResponse.json({ error: 'Failed to load bank transactions' }, { status: 500 });
    }

    const eligible = (transactions ?? []).filter(
      (t) => !t.is_reconciled || selectedIds.has(t.id)
    );

    // Calculate running totals
    const selectedTotal = eligible
      .filter((t) => selectedIds.has(t.id))
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return NextResponse.json({
      data: {
        reconciliation: recon,
        transactions: eligible.map((t) => ({
          ...t,
          selected: selectedIds.has(t.id),
        })),
        selected_total: selectedTotal,
        starting_balance: Number(recon.statement_starting_balance),
        difference: selectedTotal - (Number(recon.statement_ending_balance) - Number(recon.statement_starting_balance)),
      },
    });
  } catch (error) {
    console.error('Error fetching reconciliation items:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/accounting/reconciliations/[id]/items — toggle a transaction
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id: reconciliationId } = await context.params;
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasMinRole(ctx.role, 'member')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Verify reconciliation is in_progress and load scope
    const { data: recon, error: reconError } = await supabase
      .from('reconciliations')
      .select('status, company_id, bank_account_id, statement_date')
      .eq('id', reconciliationId)
      .eq('company_id', ctx.companyId)
      .single();

    if (reconError || !recon) {
      return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 });
    }

    if (recon.status !== 'in_progress') {
      return NextResponse.json({ error: 'Reconciliation is already completed' }, { status: 400 });
    }

    const body = await request.json();
    const { bank_transaction_id } = toggleReconciliationItemSchema.parse(body);

    // Check if already selected — if so, remove; otherwise add
    const { data: existing, error: existingError } = await supabase
      .from('reconciliation_items')
      .select('id')
      .eq('reconciliation_id', reconciliationId)
      .eq('bank_transaction_id', bank_transaction_id)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: 'Failed to check reconciliation item state' }, { status: 500 });
    }

    if (existing) {
      const { error } = await supabase
        .from('reconciliation_items')
        .delete()
        .eq('id', existing.id);

      if (error) {
        return NextResponse.json({ error: 'Failed to remove reconciliation item' }, { status: 500 });
      }

      return NextResponse.json({ action: 'removed' });
    } else {
      const { data: transaction, error: transactionError } = await supabase
        .from('bank_transactions')
        .select('id, company_id, bank_account_id, transaction_date, is_reconciled')
        .eq('id', bank_transaction_id)
        .maybeSingle();

      if (transactionError) {
        return NextResponse.json({ error: 'Failed to load bank transaction' }, { status: 500 });
      }

      if (!transaction) {
        return NextResponse.json({ error: 'Bank transaction not found' }, { status: 404 });
      }

      if (transaction.company_id !== ctx.companyId || transaction.bank_account_id !== recon.bank_account_id) {
        return NextResponse.json(
          { error: 'Bank transaction must belong to the same bank account as the reconciliation' },
          { status: 400 }
        );
      }

      if (transaction.transaction_date > recon.statement_date) {
        return NextResponse.json(
          { error: 'Bank transaction date must be on or before the statement date' },
          { status: 400 }
        );
      }

      if (transaction.is_reconciled) {
        return NextResponse.json({ error: 'Bank transaction is already reconciled' }, { status: 400 });
      }

      const { error } = await supabase
        .from('reconciliation_items')
        .insert({
          reconciliation_id: reconciliationId,
          bank_transaction_id,
        });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ action: 'added' }, { status: 201 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Error toggling reconciliation item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

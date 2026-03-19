import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateBankAccountSchema } from '@/lib/validators/bank';
import { getAccountingContext, getCompanyAccount, hasMinRole } from '@/lib/accounting/helpers';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/accounting/bank-accounts/[id]
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*, chart_of_accounts:account_id(id, account_code, name)')
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching bank account:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/accounting/bank-accounts/[id]
export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasMinRole(ctx.role, 'member')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();

    if ('current_balance' in body) {
      return NextResponse.json(
        { error: 'current_balance cannot be updated directly; it is derived from transactions and reconciliation' },
        { status: 400 }
      );
    }

    const parsed = updateBankAccountSchema.parse(body);

    if (parsed.account_id) {
      const account = await getCompanyAccount(supabase, ctx.companyId, parsed.account_id);
      if (!account || account.account_type !== 'asset') {
        return NextResponse.json(
          { error: 'Bank account GL account must be an active asset account in this company' },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from('bank_accounts')
      .update(parsed)
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .is('deleted_at', null)
      .select('*, chart_of_accounts:account_id(id, account_code, name)')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Error updating bank account:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/accounting/bank-accounts/[id] (soft delete)
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasMinRole(ctx.role, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const [{ count: transactionCount, error: transactionCountError }, { count: reconciliationCount, error: reconciliationCountError }] =
      await Promise.all([
        supabase
          .from('bank_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('bank_account_id', id)
          .eq('company_id', ctx.companyId),
        supabase
          .from('reconciliations')
          .select('id', { count: 'exact', head: true })
          .eq('bank_account_id', id)
          .eq('company_id', ctx.companyId),
      ]);

    if (transactionCountError || reconciliationCountError) {
      return NextResponse.json({ error: 'Failed to validate bank account deletion' }, { status: 500 });
    }

    if ((transactionCount ?? 0) > 0 || (reconciliationCount ?? 0) > 0) {
      return NextResponse.json(
        { error: 'Cannot delete a bank account that has transactions or reconciliations' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('bank_accounts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Failed to delete bank account' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Bank account deleted' });
  } catch (error) {
    console.error('Error deleting bank account:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

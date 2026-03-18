import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateAccountSchema } from '@/lib/validators/accounting';
import {
  getAccountingContext,
  getCompanyAccount,
  hasMinRole,
  wouldCreateAccountCycle,
} from '@/lib/accounting/helpers';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/accounting/accounts/[id]
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching account:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/accounting/accounts/[id]
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
    const parsed = updateAccountSchema.parse(body);

    const { data: existingAccount, error: existingAccountError } = await supabase
      .from('chart_of_accounts')
      .select('id, account_type')
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingAccountError) {
      console.error('Error loading existing account:', existingAccountError);
      return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
    }

    if (!existingAccount) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    if (parsed.parent_id) {
      const parent = await getCompanyAccount(supabase, ctx.companyId, parsed.parent_id);

      if (!parent) {
        return NextResponse.json({ error: 'Parent account is invalid for this company' }, { status: 400 });
      }

      const targetType = parsed.account_type ?? existingAccount.account_type;
      if (parent.account_type !== targetType) {
        return NextResponse.json({ error: 'Parent account must have the same account type' }, { status: 400 });
      }

      const createsCycle = await wouldCreateAccountCycle(supabase, ctx.companyId, id, parsed.parent_id);
      if (createsCycle) {
        return NextResponse.json({ error: 'Parent account would create a cycle' }, { status: 400 });
      }
    }

    const { data, error } = await supabase
      .from('chart_of_accounts')
      .update(parsed)
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Account code already exists' }, { status: 409 });
      }
      console.error('Error updating account:', error);
      return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Error updating account:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/accounting/accounts/[id] (soft delete)
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

    // Check if system account
    const { data: account } = await supabase
      .from('chart_of_accounts')
      .select('is_system, parent_id')
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .single();

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    if (account.is_system) {
      return NextResponse.json({ error: 'Cannot delete system accounts' }, { status: 400 });
    }

    const { count: childCount, error: childCountError } = await supabase
      .from('chart_of_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', ctx.companyId)
      .eq('parent_id', id)
      .is('deleted_at', null);

    if (childCountError) {
      console.error('Error checking child accounts:', childCountError);
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }

    if ((childCount ?? 0) > 0) {
      return NextResponse.json({ error: 'Cannot delete an account that still has child accounts' }, { status: 400 });
    }

    const { data: settingsUsingAccount, error: settingsCheckError } = await supabase
      .from('accounting_settings')
      .select('id')
      .eq('company_id', ctx.companyId)
      .or([
        `default_revenue_account_id.eq.${id}`,
        `default_expense_account_id.eq.${id}`,
        `default_ar_account_id.eq.${id}`,
        `default_ap_account_id.eq.${id}`,
        `default_cash_account_id.eq.${id}`,
        `default_tax_liability_account_id.eq.${id}`,
        `default_fx_gain_loss_account_id.eq.${id}`,
      ].join(','))
      .maybeSingle();

    if (settingsCheckError) {
      console.error('Error checking account settings usage:', settingsCheckError);
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }

    if (settingsUsingAccount) {
      return NextResponse.json({ error: 'Cannot delete an account used in accounting settings' }, { status: 400 });
    }

    // Check if account has journal entry lines
    const { count } = await supabase
      .from('journal_entry_lines')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', id);

    if (count && count > 0) {
      // Soft delete instead
      const { error } = await supabase
        .from('chart_of_accounts')
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq('id', id)
        .eq('company_id', ctx.companyId);

      if (error) {
        console.error('Error soft-deleting account:', error);
        return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
      }

      return NextResponse.json({ message: 'Account deactivated (has transactions)' });
    }

    // Hard delete if no transactions
    const { error } = await supabase
      .from('chart_of_accounts')
      .delete()
      .eq('id', id)
      .eq('company_id', ctx.companyId);

    if (error) {
      console.error('Error deleting account:', error);
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Account deleted' });
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

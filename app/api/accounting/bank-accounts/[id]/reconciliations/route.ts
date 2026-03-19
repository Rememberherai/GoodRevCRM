import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createReconciliationSchema } from '@/lib/validators/bank';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/accounting/bank-accounts/[id]/reconciliations
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id: bankAccountId } = await context.params;
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: bankAccount, error: bankAccountError } = await supabase
      .from('bank_accounts')
      .select('id')
      .eq('id', bankAccountId)
      .eq('company_id', ctx.companyId)
      .is('deleted_at', null)
      .maybeSingle();

    if (bankAccountError) {
      return NextResponse.json({ error: 'Failed to fetch bank account' }, { status: 500 });
    }

    if (!bankAccount) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('reconciliations')
      .select('*')
      .eq('bank_account_id', bankAccountId)
      .eq('company_id', ctx.companyId)
      .order('statement_date', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch reconciliations' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching reconciliations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/accounting/bank-accounts/[id]/reconciliations
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id: bankAccountId } = await context.params;
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasMinRole(ctx.role, 'member')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { data: bankAccount, error: bankAccountError } = await supabase
      .from('bank_accounts')
      .select('id')
      .eq('id', bankAccountId)
      .eq('company_id', ctx.companyId)
      .is('deleted_at', null)
      .maybeSingle();

    if (bankAccountError) {
      return NextResponse.json({ error: 'Failed to fetch bank account' }, { status: 500 });
    }

    if (!bankAccount) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    // Check for in-progress reconciliation
    const { data: existing, error: existingError } = await supabase
      .from('reconciliations')
      .select('id')
      .eq('bank_account_id', bankAccountId)
      .eq('company_id', ctx.companyId)
      .eq('status', 'in_progress')
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: 'Failed to check existing reconciliation' }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json(
        { error: 'An in-progress reconciliation already exists for this account', existing_id: existing.id },
        { status: 409 }
      );
    }

    // Get the starting balance: last completed reconciliation's ending balance, or 0
    const { data: lastRecon, error: lastReconError } = await supabase
      .from('reconciliations')
      .select('statement_ending_balance')
      .eq('bank_account_id', bankAccountId)
      .eq('company_id', ctx.companyId)
      .eq('status', 'completed')
      .order('statement_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastReconError) {
      return NextResponse.json({ error: 'Failed to load prior reconciliation balance' }, { status: 500 });
    }

    const startingBalance = lastRecon ? Number(lastRecon.statement_ending_balance) : 0;

    const body = await request.json();
    const parsed = createReconciliationSchema.parse({
      ...body,
      bank_account_id: bankAccountId,
    });

    const { data, error } = await supabase
      .from('reconciliations')
      .insert({
        ...parsed,
        company_id: ctx.companyId,
        statement_starting_balance: startingBalance,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Error creating reconciliation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createBankTransactionSchema } from '@/lib/validators/bank';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/accounting/bank-accounts/[id]/transactions
export async function GET(request: Request, context: RouteContext) {
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

    const { searchParams } = new URL(request.url);
    const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
    const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
    const page = Math.max(isNaN(rawPage) ? 1 : rawPage, 1);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 200);
    const offset = (page - 1) * limit;
    const reconciled = searchParams.get('reconciled');

    let query = supabase
      .from('bank_transactions')
      .select('*', { count: 'exact' })
      .eq('bank_account_id', bankAccountId)
      .eq('company_id', ctx.companyId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (reconciled === 'true') {
      query = query.eq('is_reconciled', true);
    } else if (reconciled === 'false') {
      query = query.eq('is_reconciled', false);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/accounting/bank-accounts/[id]/transactions
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
      .select('id, currency')
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

    const body = await request.json();
    const parsed = createBankTransactionSchema.parse({
      ...body,
      bank_account_id: bankAccountId,
    });

    const { data, error } = await supabase
      .from('bank_transactions')
      .insert({
        ...parsed,
        company_id: ctx.companyId,
        currency: bankAccount.currency,
        import_source: 'manual',
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
    console.error('Error creating transaction:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

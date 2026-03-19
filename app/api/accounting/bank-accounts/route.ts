import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createBankAccountSchema } from '@/lib/validators/bank';
import { getAccountingContext, getCompanyAccount, hasMinRole } from '@/lib/accounting/helpers';

// GET /api/accounting/bank-accounts
export async function GET() {
  try {
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*, chart_of_accounts:account_id(id, account_code, name)')
      .eq('company_id', ctx.companyId)
      .is('deleted_at', null)
      .order('name');

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch bank accounts' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/accounting/bank-accounts
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasMinRole(ctx.role, 'member')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createBankAccountSchema.parse(body);

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
      .insert({
        ...parsed,
        company_id: ctx.companyId,
      })
      .select('*, chart_of_accounts:account_id(id, account_code, name)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Error creating bank account:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

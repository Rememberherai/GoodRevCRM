import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAccountSchema } from '@/lib/validators/accounting';
import { getAccountingContext, getCompanyAccount, hasMinRole } from '@/lib/accounting/helpers';

// GET /api/accounting/accounts - List chart of accounts
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountType = searchParams.get('type');
    const activeParam = searchParams.get('active');
    const activeOnly = activeParam !== 'all' && activeParam !== 'false';

    let query = supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('company_id', ctx.companyId)
      .is('deleted_at', null)
      .order('account_code', { ascending: true });

    if (accountType) {
      query = query.eq('account_type', accountType);
    }

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching accounts:', error);
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/accounting/accounts - Create account
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
    const parsed = createAccountSchema.parse(body);

    if (parsed.parent_id) {
      const parent = await getCompanyAccount(supabase, ctx.companyId, parsed.parent_id);

      if (!parent) {
        return NextResponse.json({ error: 'Parent account is invalid for this company' }, { status: 400 });
      }

      if (parent.account_type !== parsed.account_type) {
        return NextResponse.json({ error: 'Parent account must have the same account type' }, { status: 400 });
      }
    }

    const { data, error } = await supabase
      .from('chart_of_accounts')
      .insert({
        company_id: ctx.companyId,
        ...parsed,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Account code already exists' }, { status: 409 });
      }
      console.error('Error creating account:', error);
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Error creating account:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

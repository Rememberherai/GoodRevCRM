import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateSettingsSchema } from '@/lib/validators/accounting';
import { getAccountingContext, hasMinRole, validateCompanyAccountIds } from '@/lib/accounting/helpers';

// GET /api/accounting/settings
export async function GET() {
  try {
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('accounting_settings')
      .select('*')
      .eq('company_id', ctx.companyId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/accounting/settings
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasMinRole(ctx.role, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateSettingsSchema.parse(body);

    const accountIds = [
      parsed.default_revenue_account_id,
      parsed.default_expense_account_id,
      parsed.default_ar_account_id,
      parsed.default_ap_account_id,
      parsed.default_cash_account_id,
      parsed.default_tax_liability_account_id,
      parsed.default_fx_gain_loss_account_id,
    ].filter((value): value is string => Boolean(value));

    const areAccountsValid = await validateCompanyAccountIds(supabase, ctx.companyId, accountIds);

    if (!areAccountsValid) {
      return NextResponse.json({ error: 'One or more default accounts are invalid for this company' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('accounting_settings')
      .update(parsed)
      .eq('company_id', ctx.companyId)
      .select()
      .single();

    if (error) {
      console.error('Error updating settings:', error);
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

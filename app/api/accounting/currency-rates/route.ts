import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createCurrencyRateSchema } from '@/lib/validators/accounting';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';

// GET /api/accounting/currency-rates
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fromCurrency = searchParams.get('from')?.trim().toUpperCase() ?? null;
    const toCurrency = searchParams.get('to')?.trim().toUpperCase() ?? null;

    let query = supabase
      .from('currency_rates')
      .select('*')
      .eq('company_id', ctx.companyId)
      .order('effective_date', { ascending: false })
      .limit(100);

    if (fromCurrency) {
      query = query.eq('from_currency', fromCurrency);
    }
    if (toCurrency) {
      query = query.eq('to_currency', toCurrency);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching currency rates:', error);
      return NextResponse.json({ error: 'Failed to fetch currency rates' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching currency rates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/accounting/currency-rates
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
    const parsed = createCurrencyRateSchema.parse(body);

    if (parsed.from_currency === parsed.to_currency) {
      return NextResponse.json({ error: 'From and to currencies must be different' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('currency_rates')
      .upsert(
        {
          company_id: ctx.companyId,
          ...parsed,
        },
        { onConflict: 'company_id,from_currency,to_currency,effective_date' },
      )
      .select()
      .single();

    if (error) {
      console.error('Error creating currency rate:', error);
      return NextResponse.json({ error: 'Failed to create currency rate' }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Error creating currency rate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

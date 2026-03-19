import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createTaxRateSchema } from '@/lib/validators/accounting';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';

// GET /api/accounting/tax-rates
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const activeFilter = searchParams.get('active') ?? 'active';

    let query = supabase
      .from('tax_rates')
      .select('*')
      .eq('company_id', ctx.companyId)
      .order('name');

    if (activeFilter !== 'all') {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching tax rates:', error);
      return NextResponse.json({ error: 'Failed to fetch tax rates' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching tax rates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/accounting/tax-rates
export async function POST(request: Request) {
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
    const parsed = createTaxRateSchema.parse(body);

    // If setting as default, unset other defaults first
    if (parsed.is_default) {
      const { error: unsetError } = await supabase
        .from('tax_rates')
        .update({ is_default: false })
        .eq('company_id', ctx.companyId)
        .eq('is_default', true);

      if (unsetError) {
        console.error('Error clearing existing default tax rates:', unsetError);
        return NextResponse.json({ error: 'Failed to update default tax rate' }, { status: 500 });
      }
    }

    const { data, error } = await supabase
      .from('tax_rates')
      .insert({
        company_id: ctx.companyId,
        ...parsed,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating tax rate:', error);
      return NextResponse.json({ error: 'Failed to create tax rate' }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Error creating tax rate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

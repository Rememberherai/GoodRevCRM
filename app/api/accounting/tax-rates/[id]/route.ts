import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateTaxRateSchema } from '@/lib/validators/accounting';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT /api/accounting/tax-rates/[id]
export async function PUT(request: Request, context: RouteContext) {
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

    const body = await request.json();
    const parsed = updateTaxRateSchema.parse(body);

    // If setting as default, unset other defaults first
    if (parsed.is_default) {
      const { error: unsetError } = await supabase
        .from('tax_rates')
        .update({ is_default: false })
        .eq('company_id', ctx.companyId)
        .eq('is_default', true)
        .neq('id', id);

      if (unsetError) {
        console.error('Error clearing existing default tax rates:', unsetError);
        return NextResponse.json({ error: 'Failed to update default tax rate' }, { status: 500 });
      }
    }

    const { data, error } = await supabase
      .from('tax_rates')
      .update(parsed)
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Tax rate not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Error updating tax rate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/accounting/tax-rates/[id] (soft deactivate)
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

    const { data, error } = await supabase
      .from('tax_rates')
      .update({ is_active: false })
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Tax rate not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Tax rate deactivated' });
  } catch (error) {
    console.error('Error deleting tax rate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

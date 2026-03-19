import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateBillSchema } from '@/lib/validators/bill';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/accounting/bills/[id]
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('bills')
      .select(`
        *,
        bill_line_items(*, tax_rates(id, name, rate), chart_of_accounts(id, account_code, name)),
        bill_tax_summary(*)
      `)
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Fetch payments for this bill
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .eq('bill_id', id)
      .eq('company_id', ctx.companyId)
      .is('deleted_at', null)
      .order('payment_date', { ascending: false });

    if (paymentsError) {
      return NextResponse.json({ error: 'Failed to load bill payments' }, { status: 500 });
    }

    return NextResponse.json({ data: { ...data, payments: payments ?? [] } });
  } catch (error) {
    console.error('Error fetching bill:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/accounting/bills/[id] (draft only)
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
    const parsed = updateBillSchema.parse(body);
    const { line_items, ...headerFields } = parsed;

    const { error } = await supabase.rpc('update_draft_bill', {
      p_bill_id: id,
      p_patch: headerFields as unknown as import('@/types/database').Json,
      p_lines: line_items
        ? (line_items.map((line, i) => ({
            description: line.description,
            quantity: line.quantity,
            unit_price: line.unit_price,
            account_id: line.account_id,
            tax_rate_id: line.tax_rate_id ?? null,
            sort_order: line.sort_order ?? i,
          })) as unknown as import('@/types/database').Json)
        : null,
    });

    if (error) {
      const message = error.message || 'Failed to update bill';
      const status = /not found/i.test(message)
        ? 404
        : /permission/i.test(message)
          ? 403
          : /draft|invalid|required|due date/i.test(message)
            ? 400
          : 500;
      return NextResponse.json({ error: message }, { status });
    }

    const { data, error: fetchError } = await supabase
      .from('bills')
      .select('*, bill_line_items(*, tax_rates(id, name, rate))')
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .single();

    if (fetchError || !data) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Error updating bill:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/accounting/bills/[id] (draft only)
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

    const { data: existing, error: existingError } = await supabase
      .from('bills')
      .select('status')
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: 'Failed to load bill' }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Can only delete draft bills' }, { status: 400 });
    }

    const { error } = await supabase
      .from('bills')
      .delete()
      .eq('id', id)
      .eq('company_id', ctx.companyId);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete bill' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Bill deleted' });
  } catch (error) {
    console.error('Error deleting bill:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

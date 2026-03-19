import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  counterparty_name: z.string().trim().min(1).max(255).optional(),
  counterparty_email: z.string().email().optional().nullable(),
  counterparty_address: z.string().trim().max(500).optional().nullable(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
  line_items: z.array(
    z.object({
      description: z.string().trim().min(1).max(500),
      quantity: z.number().positive().default(1),
      unit_price: z.number().min(0),
      account_id: z.string().uuid().optional().nullable(),
      tax_rate_id: z.string().uuid().optional().nullable(),
    }),
  ).min(1).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  footer: z.string().trim().max(2000).optional().nullable(),
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'annually']).optional(),
  end_date: z.string().date().optional().nullable(),
  occurrences_remaining: z.number().int().positive().optional().nullable(),
  is_active: z.boolean().optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/accounting/recurring-transactions/[id]
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('recurring_transactions')
      .select('*')
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching recurring transaction:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/accounting/recurring-transactions/[id]
export async function PATCH(request: Request, context: RouteContext) {
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
    const updates = updateSchema.parse(body);

    const existingResponse = await supabase
      .from('recurring_transactions')
      .select('start_date')
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .is('deleted_at', null)
      .single();
    const existing = existingResponse.data as { start_date: string } | null;
    const existingError = existingResponse.error;

    if (existingError || !existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (updates.end_date && updates.end_date < existing.start_date) {
      return NextResponse.json(
        { error: 'End date cannot be before start date' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('recurring_transactions')
      .update(updates)
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: error ? 500 : 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Error updating recurring transaction:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/accounting/recurring-transactions/[id] (soft delete)
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

    const { error } = await supabase
      .from('recurring_transactions')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .is('deleted_at', null)
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting recurring transaction:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

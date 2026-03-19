import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';
import { z } from 'zod';

const createSchema = z.object({
  type: z.enum(['invoice', 'bill']),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional(),
  organization_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  counterparty_name: z.string().trim().min(1).max(255),
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
  ).min(1),
  notes: z.string().trim().max(2000).optional().nullable(),
  footer: z.string().trim().max(2000).optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'annually']),
  start_date: z.string().date(),
  end_date: z.string().date().optional().nullable(),
  occurrences_remaining: z.number().int().positive().optional().nullable(),
}).superRefine((value, ctx) => {
  if (value.end_date && value.end_date < value.start_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['end_date'],
      message: 'End date cannot be before start date',
    });
  }
});

// GET /api/accounting/recurring-transactions
export async function GET() {
  try {
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('recurring_transactions')
      .select('*')
      .eq('company_id', ctx.companyId)
      .is('deleted_at', null)
      .order('next_date');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error listing recurring transactions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/accounting/recurring-transactions
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx || !hasMinRole(ctx.role, 'member')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const input = createSchema.parse(body);
    const { data: company } = await supabase
      .from('accounting_companies')
      .select('base_currency')
      .eq('id', ctx.companyId)
      .single();

    const { data, error } = await supabase
      .from('recurring_transactions')
      .insert({
        company_id: ctx.companyId,
        type: input.type,
        name: input.name,
        description: input.description ?? null,
        organization_id: input.organization_id ?? null,
        contact_id: input.contact_id ?? null,
        counterparty_name: input.counterparty_name,
        counterparty_email: input.counterparty_email ?? null,
        counterparty_address: input.counterparty_address ?? null,
        currency: input.currency ?? company?.base_currency ?? 'USD',
        line_items: input.line_items,
        notes: input.notes ?? null,
        footer: input.footer ?? null,
        project_id: input.project_id ?? null,
        frequency: input.frequency,
        start_date: input.start_date,
        end_date: input.end_date ?? null,
        next_date: input.start_date,
        occurrences_remaining: input.occurrences_remaining ?? null,
        created_by: ctx.userId,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Error creating recurring transaction:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

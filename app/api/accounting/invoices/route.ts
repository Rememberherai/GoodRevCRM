import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createInvoiceSchema } from '@/lib/validators/invoice';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';
import { emitAutomationEvent } from '@/lib/automations/engine';

// GET /api/accounting/invoices
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
    const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
    const page = Math.max(isNaN(rawPage) ? 1 : rawPage, 1);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 200);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const offset = (page - 1) * limit;

    let query = supabase
      .from('invoices')
      .select('*', { count: 'exact' })
      .eq('company_id', ctx.companyId)
      .is('deleted_at', null)
      .order('invoice_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }
    if (search) {
      query = query.or(`customer_name.ilike.%${search}%,invoice_number.ilike.%${search}%`);
    }
    if (startDate) {
      query = query.gte('invoice_date', startDate);
    }
    if (endDate) {
      query = query.lte('invoice_date', endDate);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching invoices:', error);
      return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
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
    console.error('Error fetching invoices:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/accounting/invoices
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
    const parsed = createInvoiceSchema.parse(body);

    const { data: invoiceId, error } = await supabase.rpc('create_invoice', {
      p_company_id: ctx.companyId,
      p_customer_name: parsed.customer_name,
      p_invoice_date: parsed.invoice_date,
      p_due_date: parsed.due_date,
      p_lines: parsed.line_items as unknown as import('@/types/database').Json,
      p_customer_email: parsed.customer_email ?? undefined,
      p_customer_address: parsed.customer_address ?? undefined,
      p_customer_phone: parsed.customer_phone ?? undefined,
      p_organization_id: parsed.organization_id ?? undefined,
      p_contact_id: parsed.contact_id ?? undefined,
      p_project_id: parsed.project_id ?? undefined,
      p_currency: parsed.currency,
      p_exchange_rate: parsed.exchange_rate,
      p_notes: parsed.notes ?? undefined,
      p_footer: parsed.footer ?? undefined,
      p_payment_terms: parsed.payment_terms ?? undefined,
    });

    if (error || !invoiceId) {
      const message = error?.message || 'Failed to create invoice';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { data: complete, error: fetchError } = await supabase
      .from('invoices')
      .select('*, invoice_line_items(*, tax_rates(id, name, rate))')
      .eq('id', invoiceId)
      .eq('company_id', ctx.companyId)
      .single();

    if (fetchError || !complete) {
      return NextResponse.json({ error: 'Invoice created but could not be loaded' }, { status: 500 });
    }

    if (complete.project_id) {
      emitAutomationEvent({
        projectId: complete.project_id,
        triggerType: 'invoice.created' as never,
        entityType: 'invoice' as never,
        entityId: complete.id,
        data: { invoice_number: complete.invoice_number, customer_name: complete.customer_name, total: complete.total },
      });
    }

    return NextResponse.json({ data: complete }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Error creating invoice:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

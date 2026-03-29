import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createPaymentSchema } from '@/lib/validators/invoice';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';
import { emitAutomationEvent } from '@/lib/automations/engine';

// GET /api/accounting/payments
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get('invoice_id');
    const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
    const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
    const page = Math.max(isNaN(rawPage) ? 1 : rawPage, 1);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 200);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('payments')
      .select('*, invoices(id, invoice_number, customer_name)', { count: 'exact' })
      .eq('company_id', ctx.companyId)
      .is('deleted_at', null)
      .order('payment_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (invoiceId) {
      query = query.eq('invoice_id', invoiceId);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching payments:', error);
      return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
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
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/accounting/payments
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
    const parsed = createPaymentSchema.parse(body);

    // BUG-S fix: normalise Zod nullable fields (string|null) to undefined so they map to
    // the RPC's optional params (string|undefined) rather than passing empty strings
    const { data: paymentId, error } = await supabase.rpc('record_invoice_payment', {
      p_invoice_id: parsed.invoice_id,
      p_payment_date: parsed.payment_date,
      p_amount: parsed.amount,
      p_account_id: parsed.account_id,
      p_payment_method: parsed.payment_method ?? undefined,
      p_reference: parsed.reference ?? undefined,
      p_notes: parsed.notes ?? undefined,
    });

    if (error || !paymentId) {
      const message = error?.message || 'Failed to record payment';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .eq('company_id', ctx.companyId)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json({ error: 'Payment recorded but could not be loaded' }, { status: 500 });
    }

    // Emit automation event if payment is linked to a project via invoice/bill
    const linkedInvoiceId = payment.invoice_id;
    const linkedBillId = payment.bill_id;
    if (linkedInvoiceId) {
      // BUG-T fix: exclude soft-deleted invoices from automation event lookup
      const { data: inv } = await supabase
        .from('invoices')
        .select('project_id, invoice_number, customer_name, total, balance_due, status')
        .eq('id', linkedInvoiceId)
        .eq('company_id', ctx.companyId)
        .is('deleted_at', null)
        .maybeSingle();
      if (inv?.project_id) {
        emitAutomationEvent({
          projectId: inv.project_id,
          triggerType: 'payment.received' as never,
          entityType: 'payment' as never,
          entityId: payment.id,
          data: { amount: payment.amount, invoice_id: linkedInvoiceId },
        });

        if (Number(inv.balance_due ?? 0) <= 0.005 && inv.status === 'paid') {
          emitAutomationEvent({
            projectId: inv.project_id,
            triggerType: 'invoice.paid' as never,
            entityType: 'invoice' as never,
            entityId: linkedInvoiceId,
            data: {
              invoice_number: inv.invoice_number,
              customer_name: inv.customer_name,
              total: inv.total,
              balance_due: inv.balance_due,
            },
          });
        }
      }
    } else if (linkedBillId) {
      const { data: bill } = await supabase.from('bills').select('project_id').eq('id', linkedBillId).maybeSingle();
      if (bill?.project_id) {
        emitAutomationEvent({
          projectId: bill.project_id,
          triggerType: 'payment.made' as never,
          entityType: 'payment' as never,
          entityId: payment.id,
          data: { amount: payment.amount, bill_id: linkedBillId },
        });
      }
    }

    return NextResponse.json({ data: payment }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Error recording payment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createBillPaymentSchema } from '@/lib/validators/bill';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';
import { emitAutomationEvent } from '@/lib/automations/engine';

// POST /api/accounting/bill-payments
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
    const parsed = createBillPaymentSchema.parse(body);

    const { data: paymentId, error } = await supabase.rpc('record_bill_payment', {
      p_bill_id: parsed.bill_id,
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

    if (payment.bill_id) {
      const { data: bill } = await supabase
        .from('bills')
        .select('project_id, bill_number, vendor_name, total, balance_due, status')
        .eq('id', payment.bill_id)
        .eq('company_id', ctx.companyId)
        .maybeSingle();

      if (bill?.project_id) {
        emitAutomationEvent({
          projectId: bill.project_id,
          triggerType: 'payment.made' as never,
          entityType: 'payment' as never,
          entityId: payment.id,
          data: { amount: payment.amount, bill_id: payment.bill_id },
        });

        if (Number(bill.balance_due ?? 0) <= 0.005 && bill.status === 'paid') {
          emitAutomationEvent({
            projectId: bill.project_id,
            triggerType: 'bill.paid' as never,
            entityType: 'bill' as never,
            entityId: payment.bill_id,
            data: {
              bill_number: bill.bill_number,
              vendor_name: bill.vendor_name,
              total: bill.total,
              balance_due: bill.balance_due,
            },
          });
        }
      }
    }

    return NextResponse.json({ data: payment }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Error recording bill payment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

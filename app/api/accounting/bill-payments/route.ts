import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createBillPaymentSchema } from '@/lib/validators/bill';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';

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

    return NextResponse.json({ data: payment }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Error recording bill payment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

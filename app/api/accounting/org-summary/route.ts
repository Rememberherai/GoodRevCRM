import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getAccountingContext } from '@/lib/accounting/helpers';
import { z } from 'zod';

const schema = z.object({
  organization_id: z.string().uuid(),
});

// GET /api/accounting/org-summary?organization_id=...
// Returns financial summary for a CRM organization across accounting
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const { organization_id: organizationId } = schema.parse(
      Object.fromEntries(searchParams.entries()),
    );

    const { data: company, error: companyError } = await supabase
      .from('accounting_companies')
      .select('base_currency')
      .eq('id', ctx.companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json({ error: 'Failed to load accounting company' }, { status: 500 });
    }

    const [
      { data: invoices, error: invoicesError },
      { data: bills, error: billsError },
      { data: payments, error: paymentsError },
      { data: invoiceSummaryRows, error: invoiceSummaryError },
      { data: billSummaryRows, error: billSummaryError },
      { data: paymentSummaryRows, error: paymentSummaryError },
    ] = await Promise.all([
      supabase
        .from('invoices')
        .select('id, invoice_number, invoice_date, due_date, status, total, balance_due, customer_name')
        .eq('company_id', ctx.companyId)
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .order('invoice_date', { ascending: false })
        .limit(20),
      supabase
        .from('bills')
        .select('id, bill_number, bill_date, due_date, status, total, balance_due, vendor_name')
        .eq('company_id', ctx.companyId)
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .order('bill_date', { ascending: false })
        .limit(20),
      supabase
        .from('payments')
        .select('id, payment_date, payment_type, amount, payment_method, notes')
        .eq('company_id', ctx.companyId)
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .order('payment_date', { ascending: false })
        .limit(20),
      supabase
        .from('invoices')
        .select('status, total, balance_due')
        .eq('company_id', ctx.companyId)
        .eq('organization_id', organizationId)
        .is('deleted_at', null),
      supabase
        .from('bills')
        .select('status, total, balance_due')
        .eq('company_id', ctx.companyId)
        .eq('organization_id', organizationId)
        .is('deleted_at', null),
      supabase
        .from('payments')
        .select('payment_type, amount')
        .eq('company_id', ctx.companyId)
        .eq('organization_id', organizationId)
        .is('deleted_at', null),
    ]);

    if (invoicesError || billsError || paymentsError || invoiceSummaryError || billSummaryError || paymentSummaryError) {
      console.error(
        'Error fetching org financial summary data:',
        invoicesError || billsError || paymentsError || invoiceSummaryError || billSummaryError || paymentSummaryError,
      );
      return NextResponse.json({ error: 'Failed to load financial summary' }, { status: 500 });
    }

    let totalInvoiced = 0;
    let totalArOutstanding = 0;
    let totalBilled = 0;
    let totalApOutstanding = 0;
    let totalPaymentsReceived = 0;
    let totalPaymentsMade = 0;

    for (const inv of invoiceSummaryRows ?? []) {
      if (inv.status !== 'voided' && inv.status !== 'draft') {
        totalInvoiced += Number(inv.total ?? 0);
        totalArOutstanding += Number(inv.balance_due ?? 0);
      }
    }

    for (const bill of billSummaryRows ?? []) {
      if (bill.status !== 'voided' && bill.status !== 'draft') {
        totalBilled += Number(bill.total ?? 0);
        totalApOutstanding += Number(bill.balance_due ?? 0);
      }
    }

    for (const pmt of paymentSummaryRows ?? []) {
      if (pmt.payment_type === 'received') {
        totalPaymentsReceived += Number(pmt.amount ?? 0);
      } else {
        totalPaymentsMade += Number(pmt.amount ?? 0);
      }
    }

    return NextResponse.json({
      data: {
        summary: {
          total_invoiced: totalInvoiced,
          ar_outstanding: totalArOutstanding,
          total_billed: totalBilled,
          ap_outstanding: totalApOutstanding,
          total_payments_received: totalPaymentsReceived,
          total_payments_made: totalPaymentsMade,
          currency: company.base_currency,
        },
        invoices: invoices ?? [],
        bills: bills ?? [],
        payments: payments ?? [],
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query parameters', details: error.issues }, { status: 400 });
    }
    console.error('Error fetching org financial summary:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

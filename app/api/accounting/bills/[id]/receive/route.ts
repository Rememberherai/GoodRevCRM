import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/accounting/bills/[id]/receive — Finalize and receive bill
export async function POST(_request: Request, context: RouteContext) {
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

    const { data: jeId, error } = await supabase.rpc('receive_bill', {
      p_bill_id: id,
    });

    if (error) {
      const message = error.message || 'Failed to receive bill';
      const status = /not found/i.test(message)
        ? 404
        : /insufficient permissions/i.test(message)
          ? 403
          : /must be configured/i.test(message)
            ? 400
            : 400;
      return NextResponse.json({ error: message }, { status });
    }

    // Fetch updated bill
    const { data: bill, error: fetchError } = await supabase
      .from('bills')
      .select('*, bill_line_items(*, tax_rates(id, name, rate)), bill_tax_summary(*)')
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .single();

    if (fetchError || !bill) {
      return NextResponse.json({ error: 'Bill received but could not be loaded' }, { status: 500 });
    }

    if (bill.project_id) {
      emitAutomationEvent({
        projectId: bill.project_id,
        triggerType: 'bill.received' as never,
        entityType: 'bill' as never,
        entityId: bill.id,
        data: { bill_number: bill.bill_number, vendor_name: bill.vendor_name, total: bill.total },
      });
    }

    return NextResponse.json({ data: bill, journal_entry_id: jeId });
  } catch (error) {
    console.error('Error receiving bill:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

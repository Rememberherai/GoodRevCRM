import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/accounting/invoices/[id]/send — Finalize and send invoice
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

    const { data: jeId, error } = await supabase.rpc('send_invoice', {
      p_invoice_id: id,
    });

    if (error) {
      const message = error.message || 'Failed to send invoice';
      const status = /not found/i.test(message)
        ? 404
        : /insufficient permissions/i.test(message)
          ? 403
          : /must be configured/i.test(message)
            ? 400
            : 400;
      return NextResponse.json({ error: message }, { status });
    }

    // Fetch updated invoice
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select('*, invoice_line_items(*, tax_rates(id, name, rate)), invoice_tax_summary(*)')
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .single();

    if (fetchError || !invoice) {
      return NextResponse.json({ error: 'Invoice sent but could not be loaded' }, { status: 500 });
    }

    if (invoice.project_id) {
      emitAutomationEvent({
        projectId: invoice.project_id,
        triggerType: 'invoice.sent' as never,
        entityType: 'invoice' as never,
        entityId: invoice.id,
        data: { invoice_number: invoice.invoice_number, customer_name: invoice.customer_name, total: invoice.total },
      });
    }

    return NextResponse.json({ data: invoice, journal_entry_id: jeId });
  } catch (error) {
    console.error('Error sending invoice:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

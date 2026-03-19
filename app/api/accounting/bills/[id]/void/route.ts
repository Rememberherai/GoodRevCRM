import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/accounting/bills/[id]/void — Void a received/overdue bill
export async function POST(_request: Request, context: RouteContext) {
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

    const { error } = await supabase.rpc('void_bill', {
      p_bill_id: id,
    });

    if (error) {
      const message = error.message || 'Failed to void bill';
      const status = /not found/i.test(message)
        ? 404
        : /insufficient permissions/i.test(message)
          ? 403
          : 400;
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({ message: 'Bill voided' });
  } catch (error) {
    console.error('Error voiding bill:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

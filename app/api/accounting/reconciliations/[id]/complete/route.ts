import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/accounting/reconciliations/[id]/complete
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id: reconciliationId } = await context.params;
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasMinRole(ctx.role, 'member')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { error } = await supabase.rpc('complete_reconciliation', {
      p_reconciliation_id: reconciliationId,
    });

    if (error) {
      const message = error.message || 'Failed to complete reconciliation';
      const status = /not found/i.test(message) ? 404
        : /insufficient permissions/i.test(message) ? 403
        : /does not match/i.test(message) ? 400
        : 400;
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({ message: 'Reconciliation completed' });
  } catch (error) {
    console.error('Error completing reconciliation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

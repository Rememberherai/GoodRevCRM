import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/accounting/journal-entries/[id]/void - Void a posted journal entry
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

    // Call the void function (creates reversing entry atomically)
    const { data: reversalId, error } = await supabase.rpc('void_journal_entry', {
      p_entry_id: id,
    });

    if (error) {
      const message = error.message || 'Failed to void journal entry';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Fetch both original and reversal (scoped to company)
    const { data: original } = await supabase
      .from('journal_entries')
      .select('*, journal_entry_lines(*, chart_of_accounts(id, account_code, name))')
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .single();

    const { data: reversal } = await supabase
      .from('journal_entries')
      .select('*, journal_entry_lines(*, chart_of_accounts(id, account_code, name))')
      .eq('id', reversalId)
      .eq('company_id', ctx.companyId)
      .single();

    return NextResponse.json({ data: { original, reversal } });
  } catch (error) {
    console.error('Error voiding journal entry:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

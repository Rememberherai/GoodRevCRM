import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/accounting/journal-entries/[id]/post - Post a draft journal entry
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

    // Check entry exists and is draft
    const { data: existing } = await supabase
      .from('journal_entries')
      .select('status')
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .is('deleted_at', null)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    }

    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Can only post draft journal entries' }, { status: 400 });
    }

    // Update status to posted (trigger validates balance + min lines)
    const { data, error } = await supabase
      .from('journal_entries')
      .update({ status: 'posted' })
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .select('*, journal_entry_lines(*, chart_of_accounts(id, account_code, name))')
      .single();

    if (error) {
      // The DB trigger will raise an exception if unbalanced or <2 lines
      const message = error.message || 'Failed to post journal entry';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error posting journal entry:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

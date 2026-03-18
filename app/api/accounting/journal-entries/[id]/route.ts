import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateJournalEntrySchema } from '@/lib/validators/accounting';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/accounting/journal-entries/[id]
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('journal_entries')
      .select('*, journal_entry_lines(*, chart_of_accounts(id, account_code, name))')
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching journal entry:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/accounting/journal-entries/[id] (draft only)
export async function PUT(request: Request, context: RouteContext) {
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

    const body = await request.json();
    const parsed = updateJournalEntrySchema.parse(body);
    const { lines, ...headerFields } = parsed;

    const { error } = await supabase.rpc('update_draft_journal_entry', {
      p_entry_id: id,
      p_patch: headerFields,
      p_lines: lines ?? null,
    });

    if (error) {
      const message = error.message || 'Failed to update journal entry';
      const status = /not found/i.test(message)
        ? 404
        : /insufficient permissions/i.test(message)
          ? 403
        : /draft|invalid|required|permissions/i.test(message)
          ? 400
          : 500;
      return NextResponse.json({ error: message }, { status });
    }

    // Fetch updated entry
    const { data } = await supabase
      .from('journal_entries')
      .select('*, journal_entry_lines(*, chart_of_accounts(id, account_code, name))')
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .single();

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Error updating journal entry:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/accounting/journal-entries/[id] (draft only)
export async function DELETE(_request: Request, context: RouteContext) {
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

    const { data: existing } = await supabase
      .from('journal_entries')
      .select('status')
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    }

    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Can only delete draft journal entries' }, { status: 400 });
    }

    const { error } = await supabase
      .from('journal_entries')
      .delete()
      .eq('id', id)
      .eq('company_id', ctx.companyId);

    if (error) {
      console.error('Error deleting journal entry:', error);
      return NextResponse.json({ error: 'Failed to delete journal entry' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Journal entry deleted' });
  } catch (error) {
    console.error('Error deleting journal entry:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

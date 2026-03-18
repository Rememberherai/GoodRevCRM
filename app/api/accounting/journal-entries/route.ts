import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createJournalEntrySchema } from '@/lib/validators/accounting';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';

// GET /api/accounting/journal-entries
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
    const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
    const page = Math.max(isNaN(rawPage) ? 1 : rawPage, 1);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 200);
    const status = searchParams.get('status');
    const sourceType = searchParams.get('source_type');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const offset = (page - 1) * limit;

    let query = supabase
      .from('journal_entries')
      .select('*, journal_entry_lines(*, chart_of_accounts(id, account_code, name))', { count: 'exact' })
      .eq('company_id', ctx.companyId)
      .is('deleted_at', null)
      .order('entry_date', { ascending: false })
      .order('entry_number', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }
    if (sourceType) {
      query = query.eq('source_type', sourceType);
    }
    if (startDate) {
      query = query.gte('entry_date', startDate);
    }
    if (endDate) {
      query = query.lte('entry_date', endDate);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching journal entries:', error);
      return NextResponse.json({ error: 'Failed to fetch journal entries' }, { status: 500 });
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/accounting/journal-entries
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
    const parsed = createJournalEntrySchema.parse(body);

    const { data: entryId, error } = await supabase.rpc('create_journal_entry', {
      p_company_id: ctx.companyId,
      p_entry_date: parsed.entry_date,
      p_memo: parsed.memo ?? undefined,
      p_reference: parsed.reference ?? undefined,
      p_source_type: parsed.source_type,
      p_source_id: parsed.source_id ?? undefined,
      p_project_id: parsed.project_id ?? undefined,
      p_lines: parsed.lines,
    });

    if (error || !entryId) {
      const message = error?.message || 'Failed to create journal entry';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Fetch the complete entry with lines
    const { data: complete } = await supabase
      .from('journal_entries')
      .select('*, journal_entry_lines(*, chart_of_accounts(id, account_code, name))')
      .eq('id', entryId)
      .eq('company_id', ctx.companyId)
      .single();

    return NextResponse.json({ data: complete }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Error creating journal entry:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

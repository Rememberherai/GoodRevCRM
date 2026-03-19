import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getAccountingContext } from '@/lib/accounting/helpers';
import { generalLedgerQuerySchema, parseQuery } from '@/lib/accounting/report-query';
import { generateGeneralLedger } from '@/lib/accounting/reports';
import { z } from 'zod';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const {
      start_date: startDate,
      end_date: endDate,
      project_id: projectId,
      account_id: accountId,
    } = parseQuery(searchParams, generalLedgerQuerySchema);

    const report = await generateGeneralLedger(supabase, {
      companyId: ctx.companyId,
      startDate,
      endDate,
      projectId,
      accountId,
    });

    return NextResponse.json({ data: report });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query parameters', details: error.issues }, { status: 400 });
    }
    console.error('Error generating general ledger:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

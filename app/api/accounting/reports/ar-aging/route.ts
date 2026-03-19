import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getAccountingContext } from '@/lib/accounting/helpers';
import { agingQuerySchema, parseQuery } from '@/lib/accounting/report-query';
import { generateARaging } from '@/lib/accounting/reports';
import { z } from 'zod';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const { as_of_date: asOfDate } = parseQuery(searchParams, agingQuerySchema);

    const report = await generateARaging(supabase, ctx.companyId, asOfDate);

    return NextResponse.json({ data: report });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query parameters', details: error.issues }, { status: 400 });
    }
    console.error('Error generating AR aging report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

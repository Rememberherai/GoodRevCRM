import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { csvColumnMappingSchema } from '@/lib/validators/bank';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';
import { parseCSVTransactions } from '@/lib/accounting/csv-import';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/accounting/bank-accounts/[id]/import
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id: bankAccountId } = await context.params;
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasMinRole(ctx.role, 'member')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Verify bank account exists and belongs to company
    const { data: bankAccount, error: bankAccountError } = await supabase
      .from('bank_accounts')
      .select('id, currency')
      .eq('id', bankAccountId)
      .eq('company_id', ctx.companyId)
      .is('deleted_at', null)
      .single();

    if (bankAccountError) {
      const status = /0 rows/i.test(bankAccountError.message) ? 404 : 500;
      return NextResponse.json(
        { error: status === 404 ? 'Bank account not found' : 'Failed to fetch bank account' },
        { status }
      );
    }

    if (!bankAccount) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    const body = await request.json();
    const { csv_data, column_mapping } = body;

    if (!csv_data || typeof csv_data !== 'string') {
      return NextResponse.json({ error: 'csv_data is required' }, { status: 400 });
    }

    const mapping = csvColumnMappingSchema.parse(column_mapping);
    const batchId = crypto.randomUUID();

    const transactions = parseCSVTransactions(csv_data, mapping);

    if (transactions.length === 0) {
      return NextResponse.json({ error: 'No valid transactions found in CSV' }, { status: 400 });
    }

    const rows = transactions.map((t) => ({
      bank_account_id: bankAccountId,
      company_id: ctx.companyId,
      transaction_date: t.date,
      description: t.description,
      amount: t.amount,
      currency: bankAccount.currency,
      transaction_type: t.amount >= 0 ? 'deposit' as const : 'withdrawal' as const,
      reference: t.reference || null,
      import_source: 'csv' as const,
      import_batch_id: batchId,
    }));

    const { data, error } = await supabase
      .from('bank_transactions')
      .insert(rows)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      data,
      summary: {
        imported: data.length,
        batch_id: batchId,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid column mapping', details: error.issues }, { status: 400 });
    }
    console.error('Error importing transactions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

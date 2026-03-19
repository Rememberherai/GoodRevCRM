import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';
import { z } from 'zod';

const lineSchema = z.object({
  date: z.string().date(),
  memo: z.string().optional(),
  reference: z.string().optional(),
  lines: z
    .array(
      z.object({
        account_id: z.string().uuid(),
        description: z.string().optional(),
        debit: z.number().min(0).default(0),
        credit: z.number().min(0).default(0),
      }),
    )
    .min(2)
    .superRefine((lines, ctx) => {
      for (const [index, line] of lines.entries()) {
        const hasDebit = line.debit > 0;
        const hasCredit = line.credit > 0;
        if (hasDebit === hasCredit) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index],
            message: 'Each line must have either a debit or a credit amount',
          });
        }
      }
    }),
});

const batchSchema = z.object({
  entries: z.array(lineSchema).min(1).max(500),
  auto_post: z.boolean().default(false),
});

// POST /api/accounting/journal-entries/batch-import
// Import multiple journal entries at once
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx || !hasMinRole(ctx.role, 'member')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { entries, auto_post } = batchSchema.parse(body);

    const results: Array<{ index: number; entry_id?: string; error?: string }> = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;

      // Validate debit = credit
      const totalDebit = entry.lines.reduce((sum, l) => sum + l.debit, 0);
      const totalCredit = entry.lines.reduce((sum, l) => sum + l.credit, 0);

      if (Math.abs(totalDebit - totalCredit) > 0.005) {
        results.push({
          index: i,
          error: `Entry ${i + 1}: debits (${totalDebit.toFixed(2)}) != credits (${totalCredit.toFixed(2)})`,
        });
        errorCount++;
        continue;
      }

      // Create journal entry via RPC
      const { data: entryId, error: createErr } = await supabase.rpc('create_journal_entry', {
        p_company_id: ctx.companyId,
        p_entry_date: entry.date,
        p_memo: entry.memo ?? undefined,
        p_reference: entry.reference ?? undefined,
        p_source_type: 'manual',
        p_lines: JSON.stringify(
          entry.lines.map((l) => ({
            account_id: l.account_id,
            description: l.description ?? '',
            debit: l.debit,
            credit: l.credit,
          })),
        ),
      });

      if (createErr) {
        results.push({ index: i, error: createErr.message });
        errorCount++;
        continue;
      }

      // Auto-post if requested
      if (auto_post && entryId) {
        const { error: postErr } = await supabase
          .from('journal_entries')
          .update({
            status: 'posted',
            posted_at: new Date().toISOString(),
          })
          .eq('id', entryId)
          .eq('company_id', ctx.companyId);

        if (postErr) {
          results.push({ index: i, entry_id: entryId, error: `Created but failed to post: ${postErr.message}` });
          errorCount++;
          continue;
        }
      }

      results.push({ index: i, entry_id: entryId ?? undefined });
      successCount++;
    }

    return NextResponse.json({
      data: {
        total: entries.length,
        success: successCount,
        errors: errorCount,
        results,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Error in batch journal import:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

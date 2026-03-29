import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';


/**
 * Return the number of days in a given month (0-indexed).
 */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

interface ProcessResult {
  processed: number;
  errors: number;
  details: Array<{ id: string; type: string; name: string; error?: string }>;
}

/**
 * Calculate the next recurrence date given the current date and frequency.
 */
export function advanceDate(current: Date, frequency: string): Date {
  const next = new Date(current);
  const originalDay = current.getDate();
  switch (frequency) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setDate(1);
      next.setMonth(next.getMonth() + 1);
      next.setDate(Math.min(originalDay, daysInMonth(next.getFullYear(), next.getMonth())));
      break;
    case 'quarterly':
      next.setDate(1);
      next.setMonth(next.getMonth() + 3);
      next.setDate(Math.min(originalDay, daysInMonth(next.getFullYear(), next.getMonth())));
      break;
    case 'annually':
      next.setDate(1);
      next.setFullYear(next.getFullYear() + 1);
      next.setDate(Math.min(originalDay, daysInMonth(next.getFullYear(), next.getMonth())));
      break;
    default:
      next.setDate(1);
      next.setMonth(next.getMonth() + 1);
      next.setDate(Math.min(originalDay, daysInMonth(next.getFullYear(), next.getMonth())));
  }
  return next;
}

function toDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Process all due recurring transactions.
 * Creates invoices or bills from templates, then advances the schedule.
 */
export async function processRecurringTransactions(
  supabase: SupabaseClient<Database>,
): Promise<ProcessResult> {
  const today = toDateStr(new Date());
  const result: ProcessResult = { processed: 0, errors: 0, details: [] };

  // Fetch all due recurring transactions
  const { data: recurrings, error } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('is_active', true)
    .is('deleted_at', null)
    .lte('next_date', today);

  if (error || !recurrings) {
    console.error('Error fetching recurring transactions:', error);
    return result;
  }

  for (const rec of recurrings) {
    try {
      // BUG-BH fix: if schedule already expired, deactivate without creating a document
      if (rec.end_date && rec.next_date > rec.end_date) {
        await supabase
          .from('recurring_transactions')
          .update({ is_active: false })
          .eq('id', rec.id)
          .eq('next_date', rec.next_date);
        result.details.push({ id: rec.id, type: rec.type, name: rec.name });
        continue;
      }

      // BUG-AZ fix: atomically claim this record by advancing next_date first.
      // Only the worker that wins the race (sees the original next_date) proceeds.
      // BUG-K fix: parse at local noon to avoid UTC-midnight timezone drift.
      const nextDateAfter = toDateStr(advanceDate(
        new Date(rec.next_date + 'T12:00:00'),
        rec.frequency,
      ));
      const remaining =
        rec.occurrences_remaining != null ? rec.occurrences_remaining - 1 : null;
      const shouldDeactivate =
        (remaining != null && remaining <= 0) ||
        (rec.end_date != null && nextDateAfter > rec.end_date);

      const { data: claimResult } = await supabase
        .from('recurring_transactions')
        .update({
          next_date: nextDateAfter,
          last_generated_at: new Date().toISOString(),
          total_generated: rec.total_generated + 1,
          occurrences_remaining: remaining,
          is_active: shouldDeactivate ? false : true,
        })
        .eq('id', rec.id)
        .eq('next_date', rec.next_date) // atomic claim — concurrent worker will see updated value and skip
        .eq('is_active', true)
        .select('id');

      if (!claimResult || claimResult.length === 0) {
        // Another worker already processed this record
        continue;
      }

      // Get accounting settings for defaults
      const { data: settings } = await supabase
        .from('accounting_settings')
        .select('default_payment_terms, default_revenue_account_id, default_expense_account_id')
        .eq('company_id', rec.company_id)
        .single();

      const paymentTerms = settings?.default_payment_terms ?? 30;
      const invoiceDate = rec.next_date;
      // BUG-K fix: parse at local noon to avoid UTC-midnight timezone drift
      const dueDate = toDateStr(
        new Date(new Date(rec.next_date + 'T12:00:00').getTime() + paymentTerms * 86400000),
      );

      // Build line items from template
      const fallbackAccountId =
        rec.type === 'invoice'
          ? settings?.default_revenue_account_id
          : settings?.default_expense_account_id;
      const rawLineItems = Array.isArray(rec.line_items) ? rec.line_items : [];
      const lineItems = rawLineItems.map((item) => {
        const line = typeof item === 'object' && item !== null ? item as Record<string, unknown> : {};
        const quantityValue = typeof line.quantity === 'number' ? line.quantity : Number(line.quantity ?? 1);
        const unitPriceValue = typeof line.unit_price === 'number' ? line.unit_price : Number(line.unit_price ?? 0);

        return {
          description: typeof line.description === 'string' ? line.description : '',
          quantity: Number.isFinite(quantityValue) ? quantityValue : 1,
          unit_price: Number.isFinite(unitPriceValue) ? unitPriceValue : 0,
          account_id: typeof line.account_id === 'string' ? line.account_id : fallbackAccountId ?? null,
          tax_rate_id: typeof line.tax_rate_id === 'string' ? line.tax_rate_id : null,
        };
      });

      if (lineItems.length === 0) {
        throw new Error('Recurring template has no line items');
      }

      if (lineItems.some((item) => !item.account_id)) {
        throw new Error(
          rec.type === 'invoice'
            ? 'Missing revenue account on recurring invoice template'
            : 'Missing expense account on recurring bill template',
        );
      }

      if (rec.type === 'invoice') {
        // Create invoice via RPC
        const { error: createErr } = await supabase.rpc('create_invoice', {
          p_company_id: rec.company_id,
          p_customer_name: rec.counterparty_name,
          p_customer_email: rec.counterparty_email ?? undefined,
          p_customer_address: rec.counterparty_address ?? undefined,
          p_invoice_date: invoiceDate,
          p_due_date: dueDate,
          p_payment_terms: paymentTerms,
          p_currency: rec.currency,
          p_notes: rec.notes ?? undefined,
          p_footer: rec.footer ?? undefined,
          p_organization_id: rec.organization_id ?? undefined,
          p_contact_id: rec.contact_id ?? undefined,
          p_project_id: rec.project_id ?? undefined,
          p_lines: lineItems,
          p_created_by: rec.created_by ?? undefined,
        });

        if (createErr) throw new Error(createErr.message);
      } else {
        // Use create_bill RPC which handles bill + line items atomically
        const { error: billErr } = await supabase.rpc('create_bill', {
          p_company_id: rec.company_id,
          p_vendor_name: rec.counterparty_name,
          p_vendor_email: rec.counterparty_email ?? undefined,
          p_vendor_address: rec.counterparty_address ?? undefined,
          p_bill_date: invoiceDate,
          p_due_date: dueDate,
          p_payment_terms: paymentTerms,
          p_currency: rec.currency,
          p_notes: rec.notes ?? undefined,
          p_organization_id: rec.organization_id ?? undefined,
          p_contact_id: rec.contact_id ?? undefined,
          p_project_id: rec.project_id ?? undefined,
          p_lines: lineItems,
        });

        if (billErr) throw new Error(billErr.message);
      }

      // Schedule was already advanced at the top of the loop (optimistic claim)
      result.processed++;
      result.details.push({ id: rec.id, type: rec.type, name: rec.name });
    } catch (err) {
      result.errors++;
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Error processing recurring transaction ${rec.id}:`, message);
      result.details.push({ id: rec.id, type: rec.type, name: rec.name, error: message });
    }
  }

  return result;
}

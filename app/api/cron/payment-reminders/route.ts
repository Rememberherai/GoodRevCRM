import { NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';
import { verifyCronAuth } from '@/lib/scheduler/cron-auth';

export const maxDuration = 60;

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Cron job: check for overdue invoices and approaching due dates.
 *
 * Auth: CRON_SECRET bearer token OR session cookie (browser scheduler)
 */
export async function GET(request: Request) {
  const isAuthed = await verifyCronAuth(request);
  if (!isAuthed) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabase = createServiceClient();
  const today = localDateString(new Date());
  const results = { overdue_marked: 0, reminders_created: 0, errors: 0 };

  try {
    // 1. Mark overdue invoices
    const { data: overdueInvoices, error: overdueErr } = await supabase
      .from('invoices')
      .update({ status: 'overdue' })
      .in('status', ['sent', 'partially_paid'])
      .lt('due_date', today)
      .is('deleted_at', null)
      .select('id');

    if (overdueErr) {
      console.error('Error marking overdue invoices:', overdueErr);
      results.errors++;
    } else {
      results.overdue_marked = overdueInvoices?.length ?? 0;
    }

    // 2. Mark overdue bills
    const { error: billOverdueErr } = await supabase
      .from('bills')
      .update({ status: 'overdue' })
      .in('status', ['received', 'partially_paid'])
      .lt('due_date', today)
      .is('deleted_at', null);

    if (billOverdueErr) {
      console.error('Error marking overdue bills:', billOverdueErr);
      results.errors++;
    }

    // 3. Find invoices due within 7 days (approaching) and create reminder tasks
    const sevenDaysOut = new Date();
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
    const sevenDaysStr = localDateString(sevenDaysOut);

    const { data: approachingInvoices, error: approachingError } = await supabase
      .from('invoices')
      .select('id, invoice_number, customer_name, total, due_date, company_id')
      .in('status', ['sent', 'partially_paid'])
      .gte('due_date', today)
      .lte('due_date', sevenDaysStr)
      .is('deleted_at', null);

    if (approachingError) {
      console.error('Error fetching approaching invoices:', approachingError);
      results.errors++;
      return NextResponse.json({ success: true, ...results });
    }

    // TODO: INCOMPLETE FEATURE — reminder sending is not implemented yet.
    // Currently only logs approaching invoices. A full implementation would:
    // - Check if a reminder was already sent for this invoice
    // - Send email via Gmail service or create an in-app notification
    // - Only then increment reminders_created
    if (approachingInvoices && approachingInvoices.length > 0) {
      console.log(
        `[PAYMENT_REMINDERS] ${approachingInvoices.length} invoices approaching due date (reminders not yet implemented)`,
      );
    }
  } catch (err) {
    console.error('Error in payment reminders cron:', err);
    results.errors++;
  }

  return NextResponse.json({ success: true, ...results });
}

import { NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';
import { verifyCronAuth } from '@/lib/scheduler/cron-auth';
import { processRecurringTransactions } from '@/lib/accounting/recurring';

export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const isAuthed = await verifyCronAuth(request);
    if (!isAuthed) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const supabase = createServiceClient();
    const result = await processRecurringTransactions(supabase);

    return NextResponse.json({
      success: true,
      processed: result.processed,
      errors: result.errors,
      details: result.details,
    });
  } catch (error) {
    console.error('Error processing recurring transactions cron:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

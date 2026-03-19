import { createClient } from '@/lib/supabase/server';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';
import { redirect } from 'next/navigation';
import { RecurringTransactionForm } from '@/components/accounting/recurring-transaction-form';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function NewRecurringTransactionPage() {
  const supabase = await createClient();
  const ctx = await getAccountingContext(supabase);

  if (!ctx || !hasMinRole(ctx.role, 'member')) {
    redirect('/accounting');
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/accounting/recurring"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">New Recurring Transaction</h1>
      </div>
      <RecurringTransactionForm />
    </div>
  );
}

import { createClient } from '@/lib/supabase/server';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';
import { redirect } from 'next/navigation';
import { RecurringTransactionList } from '@/components/accounting/recurring-transaction-list';

export default async function RecurringTransactionsPage() {
  const supabase = await createClient();
  const ctx = await getAccountingContext(supabase);

  if (!ctx) {
    redirect('/accounting');
  }

  const canManage = hasMinRole(ctx.role, 'member');
  const canDelete = hasMinRole(ctx.role, 'admin');

  return (
    <div className="p-6">
      <RecurringTransactionList canManage={canManage} canDelete={canDelete} />
    </div>
  );
}

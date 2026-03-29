import { createClient } from '@/lib/supabase/server';
import { getAccountingMembershipForUser } from '@/lib/accounting/helpers';
import { redirect } from 'next/navigation';
import { BalanceSheetReportView } from '@/components/accounting/reports/balance-sheet-report';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function BalanceSheetPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const membership = await getAccountingMembershipForUser(supabase, user.id);

  if (!membership) {
    redirect('/accounting');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/accounting/reports"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-bold">Balance Sheet</h1>
      </div>
      <BalanceSheetReportView />
    </div>
  );
}

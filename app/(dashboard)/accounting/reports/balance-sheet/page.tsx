import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { BalanceSheetReportView } from '@/components/accounting/reports/balance-sheet-report';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function BalanceSheetPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = user
    ? await supabase
        .from('accounting_company_memberships')
        .select('company_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
    : { data: null };

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

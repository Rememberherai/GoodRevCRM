import { BankTransactionList } from '@/components/accounting/bank-transaction-list';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import { redirect } from 'next/navigation';

interface BankAccountPageProps {
  params: Promise<{ id: string }>;
}

export default async function BankAccountPage({ params }: BankAccountPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = user
    ? await supabase
        .from('accounting_company_memberships')
        .select('role')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
    : { data: null };

  if (!membership) {
    redirect('/accounting');
  }

  return (
    <BankTransactionList
      bankAccountId={id}
      role={membership.role as Database['public']['Enums']['accounting_role']}
    />
  );
}

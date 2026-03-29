import { BankTransactionList } from '@/components/accounting/bank-transaction-list';
import { getAccountingMembershipForUser } from '@/lib/accounting/helpers';
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

  if (!user) {
    redirect('/login');
  }

  const membership = await getAccountingMembershipForUser(supabase, user.id);

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

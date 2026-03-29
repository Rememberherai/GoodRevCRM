import { createClient } from '@/lib/supabase/server';
import { getAccountingMembershipWithCompanyForUser } from '@/lib/accounting/helpers';
import { redirect } from 'next/navigation';
import { AccountingShell } from './accounting-shell';

export default async function AccountingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const membership = await getAccountingMembershipWithCompanyForUser(supabase, user.id);
  const company = membership?.company ?? null;
  const companyId = membership?.companyId ?? null;

  return (
    <AccountingShell
      company={company}
      companyId={companyId}
    >
      {children}
    </AccountingShell>
  );
}

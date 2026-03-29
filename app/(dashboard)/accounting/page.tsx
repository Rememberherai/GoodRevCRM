import { createClient } from '@/lib/supabase/server';
import { getAccountingMembershipWithCompanyForUser } from '@/lib/accounting/helpers';
import { redirect } from 'next/navigation';
import { AccountingOnboarding } from './accounting-onboarding';
import { AccountingOverview } from './accounting-overview';

export default async function AccountingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const membership = await getAccountingMembershipWithCompanyForUser(supabase, user.id);

  if (!membership?.company) {
    return <AccountingOnboarding />;
  }

  return <AccountingOverview company={membership.company} />;
}

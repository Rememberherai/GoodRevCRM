import { createClient } from '@/lib/supabase/server';
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

  // Check if user has an accounting company
  const { data: membership } = await supabase
    .from('accounting_company_memberships')
    .select('company_id, role, accounting_companies(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership?.accounting_companies) {
    return <AccountingOnboarding />;
  }

  return <AccountingOverview company={membership.accounting_companies} />;
}

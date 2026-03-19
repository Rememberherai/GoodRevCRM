import { createClient } from '@/lib/supabase/server';
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

  // Fetch user's accounting company (via membership)
  const { data: membership } = await supabase
    .from('accounting_company_memberships')
    .select('company_id, role, accounting_companies(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const company = membership?.accounting_companies ?? null;
  const companyId = membership?.company_id ?? null;

  return (
    <AccountingShell
      company={company}
      companyId={companyId}
    >
      {children}
    </AccountingShell>
  );
}

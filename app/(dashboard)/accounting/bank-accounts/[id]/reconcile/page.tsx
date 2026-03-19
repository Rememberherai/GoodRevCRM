import { ReconciliationWizard } from '@/components/accounting/reconciliation-wizard';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

interface ReconcilePageProps {
  params: Promise<{ id: string }>;
}

export default async function ReconcilePage({ params }: ReconcilePageProps) {
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
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
    : { data: null };

  if (!membership) {
    redirect('/accounting');
  }

  if (membership.role === 'viewer') {
    redirect(`/accounting/bank-accounts/${id}`);
  }

  return <ReconciliationWizard bankAccountId={id} />;
}

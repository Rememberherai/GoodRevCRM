import { ReconciliationWizard } from '@/components/accounting/reconciliation-wizard';
import { getAccountingMembershipForUser } from '@/lib/accounting/helpers';
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

  if (!user) {
    redirect('/login');
  }

  const membership = await getAccountingMembershipForUser(supabase, user.id);

  if (!membership) {
    redirect('/accounting');
  }

  if (membership.role === 'viewer') {
    redirect(`/accounting/bank-accounts/${id}`);
  }

  return <ReconciliationWizard bankAccountId={id} />;
}

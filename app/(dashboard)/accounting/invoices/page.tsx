import { InvoiceList } from '@/components/accounting/invoice-list';
import { getAccountingMembershipForUser } from '@/lib/accounting/helpers';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function InvoicesPage() {
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

  const canCreate = membership.role !== 'viewer';

  return <InvoiceList canCreate={canCreate} />;
}

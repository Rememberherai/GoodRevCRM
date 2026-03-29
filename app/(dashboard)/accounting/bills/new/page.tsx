import { BillForm } from '@/components/accounting/bill-form';
import { getAccountingMembershipForUser } from '@/lib/accounting/helpers';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function NewBillPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const membership = await getAccountingMembershipForUser(supabase, user.id);

  if (!membership || membership.role === 'viewer') {
    redirect('/accounting/bills');
  }

  return <BillForm />;
}

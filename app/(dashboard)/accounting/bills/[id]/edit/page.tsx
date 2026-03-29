import { BillForm } from '@/components/accounting/bill-form';
import { getAccountingMembershipForUser } from '@/lib/accounting/helpers';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

interface EditBillPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditBillPage({ params }: EditBillPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const membership = await getAccountingMembershipForUser(supabase, user.id);

  if (!membership || membership.role === 'viewer') {
    redirect(`/accounting/bills/${id}`);
  }

  const { data: bill } = await supabase
    .from('bills')
    .select('status')
    .eq('id', id)
    .eq('company_id', membership.companyId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!bill) {
    redirect('/accounting/bills');
  }

  if (bill.status !== 'draft') {
    redirect(`/accounting/bills/${id}`);
  }

  return <BillForm billId={id} />;
}

import { BillForm } from '@/components/accounting/bill-form';
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

  const { data: membership } = user
    ? await supabase
        .from('accounting_company_memberships')
        .select('company_id, role')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
    : { data: null };

  if (!membership || membership.role === 'viewer') {
    redirect(`/accounting/bills/${id}`);
  }

  const { data: bill } = await supabase
    .from('bills')
    .select('status')
    .eq('id', id)
    .eq('company_id', membership.company_id)
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

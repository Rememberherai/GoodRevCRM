import { BillList } from '@/components/accounting/bill-list';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function BillsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = user
    ? await supabase
        .from('accounting_company_memberships')
        .select('role')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
    : { data: null };

  if (!membership) {
    redirect('/accounting');
  }

  const canCreate = membership.role !== 'viewer';

  return <BillList canCreate={canCreate} />;
}

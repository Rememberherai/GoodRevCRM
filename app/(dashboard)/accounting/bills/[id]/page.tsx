import { BillDetail } from '@/components/accounting/bill-detail';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import { redirect } from 'next/navigation';

interface BillPageProps {
  params: Promise<{ id: string }>;
}

export default async function BillPage({ params }: BillPageProps) {
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

  const role = membership.role as Database['public']['Enums']['accounting_role'];

  return <BillDetail billId={id} role={role} />;
}

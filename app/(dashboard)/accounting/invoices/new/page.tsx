import { InvoiceForm } from '@/components/accounting/invoice-form';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function NewInvoicePage() {
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

  if (!membership || membership.role === 'viewer') {
    redirect('/accounting/invoices');
  }

  return <InvoiceForm />;
}

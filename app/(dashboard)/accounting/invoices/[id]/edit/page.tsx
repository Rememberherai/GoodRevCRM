import { InvoiceForm } from '@/components/accounting/invoice-form';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

interface EditInvoicePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditInvoicePage({ params }: EditInvoicePageProps) {
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
    redirect(`/accounting/invoices/${id}`);
  }

  const { data: invoice } = await supabase
    .from('invoices')
    .select('status')
    .eq('id', id)
    .eq('company_id', membership.company_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!invoice) {
    redirect('/accounting/invoices');
  }

  if (invoice.status !== 'draft') {
    redirect(`/accounting/invoices/${id}`);
  }

  return <InvoiceForm invoiceId={id} />;
}

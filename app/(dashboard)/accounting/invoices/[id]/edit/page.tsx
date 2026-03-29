import { InvoiceForm } from '@/components/accounting/invoice-form';
import { getAccountingMembershipForUser } from '@/lib/accounting/helpers';
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

  if (!user) {
    redirect('/login');
  }

  const membership = await getAccountingMembershipForUser(supabase, user.id);

  if (!membership || membership.role === 'viewer') {
    redirect(`/accounting/invoices/${id}`);
  }

  const { data: invoice } = await supabase
    .from('invoices')
    .select('status')
    .eq('id', id)
    .eq('company_id', membership.companyId)
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

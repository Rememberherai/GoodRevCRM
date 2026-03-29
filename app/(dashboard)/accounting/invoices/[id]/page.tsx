import { InvoiceDetail } from '@/components/accounting/invoice-detail';
import { getAccountingMembershipForUser } from '@/lib/accounting/helpers';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import { redirect } from 'next/navigation';

interface InvoicePageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoicePage({ params }: InvoicePageProps) {
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

  const role = membership.role as Database['public']['Enums']['accounting_role'];

  return <InvoiceDetail invoiceId={id} role={role} />;
}

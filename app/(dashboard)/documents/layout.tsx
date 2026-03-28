import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DocumentsShell } from './documents-shell';

export default async function DocumentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <DocumentsShell>
      {children}
    </DocumentsShell>
  );
}

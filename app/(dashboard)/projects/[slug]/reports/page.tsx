import { createClient } from '@/lib/supabase/server';
import { ReportsPageClient } from './reports-page-client';

interface ReportsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ReportsPage({ params }: ReportsPageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return <ReportsPageClient projectSlug={slug} currentUserId={user?.id ?? ''} />;
}

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ReportsPageClient } from './reports-page-client';
import { GrantsReportsPageClient } from './grants-reports-page-client';

interface ReportsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ReportsPage({ params }: ReportsPageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: project } = await supabase
    .from('projects')
    .select('project_type')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (project?.project_type === 'community') {
    redirect(`/projects/${slug}/reports/overview`);
  }

  if (project?.project_type === 'grants') {
    return <GrantsReportsPageClient projectSlug={slug} />;
  }

  return <ReportsPageClient projectSlug={slug} currentUserId={user?.id ?? ''} />;
}

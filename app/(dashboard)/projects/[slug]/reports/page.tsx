import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { Skeleton } from '@/components/ui/skeleton';
import { ReportsPageClient } from './reports-page-client';
import { CommunityReportsWrapper } from './community-reports-wrapper';
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
    return (
      <Suspense fallback={<div className="space-y-6"><Skeleton className="h-10 w-96" /><Skeleton className="h-96 rounded-xl" /></div>}>
        <CommunityReportsWrapper projectSlug={slug} />
      </Suspense>
    );
  }

  if (project?.project_type === 'grants') {
    return <GrantsReportsPageClient projectSlug={slug} />;
  }

  return <ReportsPageClient projectSlug={slug} currentUserId={user?.id ?? ''} />;
}

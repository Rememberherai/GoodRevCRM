import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Skeleton } from '@/components/ui/skeleton';
import { ContractorPortalPageClient } from './contractor-portal-page-client';

interface ContractorPortalPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ContractorPortalPage({ params }: ContractorPortalPageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let contractorPersonId: string | null = null;

  if (user) {
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (project) {
      const { data: person } = await admin
        .from('people')
        .select('id')
        .eq('project_id', project.id)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .maybeSingle();

      contractorPersonId = person?.id ?? null;
    }
  }

  return (
    <Suspense fallback={<PortalSkeleton />}>
      <ContractorPortalPageClient projectSlug={slug} contractorPersonId={contractorPersonId} />
    </Suspense>
  );
}

function PortalSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

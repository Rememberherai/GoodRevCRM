import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { CommunityReportsPageClient } from '../community-reports-page-client';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ReportsOverviewPage({ params }: PageProps) {
  const { slug } = await params;

  return (
    <Suspense fallback={<ReportsSkeleton />}>
      <CommunityReportsPageClient projectSlug={slug} />
    </Suspense>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-[480px] rounded-xl" />
    </div>
  );
}

import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { JobsPageClient } from '../../jobs/jobs-page-client';

export default function JobsSubtabPage() {
  return (
    <Suspense fallback={<JobsSkeleton />}>
      <JobsPageClient />
    </Suspense>
  );
}

function JobsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-[480px] rounded-xl" />
    </div>
  );
}

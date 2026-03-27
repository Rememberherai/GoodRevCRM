import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkforcePageClient } from './workforce-page-client';

export default function WorkforcePage() {
  return (
    <Suspense fallback={<WorkforceSkeleton />}>
      <WorkforcePageClient />
    </Suspense>
  );
}

function WorkforceSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-10 w-96" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

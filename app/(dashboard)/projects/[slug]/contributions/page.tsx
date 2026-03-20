import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ContributionsPageClient } from './contributions-page-client';

export default function ContributionsPage() {
  return (
    <Suspense fallback={<ContributionsPageSkeleton />}>
      <ContributionsPageClient />
    </Suspense>
  );
}

function ContributionsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-44" />
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

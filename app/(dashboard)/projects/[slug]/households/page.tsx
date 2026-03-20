import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { HouseholdsPageClient } from './households-page-client';

export default function HouseholdsPage() {
  return (
    <Suspense fallback={<HouseholdsPageSkeleton />}>
      <HouseholdsPageClient />
    </Suspense>
  );
}

function HouseholdsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1 max-w-sm" />
      </div>
      <div className="rounded-lg border p-4 space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        ))}
      </div>
    </div>
  );
}

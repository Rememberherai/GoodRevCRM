import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { CommunityMapPageClient } from './community-map-page-client';

export default function CommunityMapPage() {
  return (
    <Suspense fallback={<CommunityMapSkeleton />}>
      <CommunityMapPageClient />
    </Suspense>
  );
}

function CommunityMapSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-[70vh] rounded-xl" />
      </div>
    </div>
  );
}

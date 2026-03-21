import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { BroadcastsPageClient } from './broadcasts-page-client';

export default function BroadcastsPage() {
  return (
    <Suspense fallback={<BroadcastsPageSkeleton />}>
      <BroadcastsPageClient />
    </Suspense>
  );
}

function BroadcastsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <Skeleton className="h-[480px] rounded-xl" />
    </div>
  );
}

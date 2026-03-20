import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { AssetsPageClient } from './assets-page-client';

export default function CommunityAssetsPage() {
  return (
    <Suspense fallback={<AssetsPageSkeleton />}>
      <AssetsPageClient />
    </Suspense>
  );
}

function AssetsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

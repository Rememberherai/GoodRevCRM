import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { AssetsHubPageClient } from './assets-hub-page-client';

export default function AssetsHubPage() {
  return (
    <Suspense fallback={<AssetsHubSkeleton />}>
      <AssetsHubPageClient />
    </Suspense>
  );
}

function AssetsHubSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-10 w-96" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

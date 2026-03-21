import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import GrantDetailClient from './grant-detail-client';

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

export default function GrantDetailPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <GrantDetailClient />
    </Suspense>
  );
}

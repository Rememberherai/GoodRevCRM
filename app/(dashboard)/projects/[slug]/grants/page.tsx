import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import GrantsPageClient from './grants-page-client';

function GrantsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24" />
        ))}
      </div>
      <Skeleton className="h-[500px] rounded-xl" />
    </div>
  );
}

export default function GrantsPage() {
  return (
    <Suspense fallback={<GrantsSkeleton />}>
      <GrantsPageClient />
    </Suspense>
  );
}

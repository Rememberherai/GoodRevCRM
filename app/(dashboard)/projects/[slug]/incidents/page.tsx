import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { IncidentsPageClient } from './incidents-page-client';

export default function IncidentsPage() {
  return (
    <Suspense fallback={<IncidentsPageSkeleton />}>
      <IncidentsPageClient />
    </Suspense>
  );
}

function IncidentsPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

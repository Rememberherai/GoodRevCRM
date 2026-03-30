import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { IncidentDetailClient } from './incident-detail-client';

export default function IncidentDetailPage() {
  return (
    <Suspense fallback={<IncidentDetailSkeleton />}>
      <IncidentDetailClient />
    </Suspense>
  );
}

function IncidentDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-8 w-80" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { EventDetailClient } from './event-detail-client';

export default function EventDetailPage() {
  return (
    <Suspense fallback={<EventDetailSkeleton />}>
      <EventDetailClient />
    </Suspense>
  );
}

function EventDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-60 rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { BroadcastsPageClient } from '../../broadcasts/broadcasts-page-client';

export default function CommunicationsBroadcastsPage() {
  return (
    <Suspense fallback={<BroadcastsSkeleton />}>
      <BroadcastsPageClient />
    </Suspense>
  );
}

function BroadcastsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-[480px] rounded-xl" />
    </div>
  );
}

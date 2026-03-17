import { Suspense } from 'react';
import { ContractDetailClient } from './contract-detail-client';
import { Skeleton } from '@/components/ui/skeleton';

export default function ContractDetailPage() {
  return (
    <Suspense fallback={<ContractDetailSkeleton />}>
      <ContractDetailClient />
    </Suspense>
  );
}

function ContractDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-6 w-6" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Skeleton className="h-[200px] rounded-lg" />
          <Skeleton className="h-[300px] rounded-lg" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-[200px] rounded-lg" />
          <Skeleton className="h-[150px] rounded-lg" />
        </div>
      </div>
    </div>
  );
}

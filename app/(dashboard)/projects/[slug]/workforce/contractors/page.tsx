import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ContractorsPageClient } from '../../contractors/contractors-page-client';

export default function ContractorsSubtabPage() {
  return (
    <Suspense fallback={<ContractorsSkeleton />}>
      <ContractorsPageClient />
    </Suspense>
  );
}

function ContractorsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-[480px] rounded-xl" />
    </div>
  );
}

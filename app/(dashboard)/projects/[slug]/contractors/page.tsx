import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ContractorsPageClient } from './contractors-page-client';

export default function ContractorsPage() {
  return (
    <Suspense fallback={<ContractorsPageSkeleton />}>
      <ContractorsPageClient />
    </Suspense>
  );
}

function ContractorsPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

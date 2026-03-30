import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { CasesPageClient } from './cases-page-client';

export default function CasesPage() {
  return (
    <Suspense fallback={<CasesPageSkeleton />}>
      <CasesPageClient />
    </Suspense>
  );
}

function CasesPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

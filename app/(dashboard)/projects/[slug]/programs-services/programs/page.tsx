import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ProgramsPageClient } from '../../programs/programs-page-client';

export default function ProgramsSubtabPage() {
  return (
    <Suspense fallback={<ProgramsSkeleton />}>
      <ProgramsPageClient />
    </Suspense>
  );
}

function ProgramsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-[480px] rounded-xl" />
    </div>
  );
}

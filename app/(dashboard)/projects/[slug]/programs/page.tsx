import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ProgramsPageClient } from './programs-page-client';

export default function ProgramsPage() {
  return (
    <Suspense fallback={<ProgramsPageSkeleton />}>
      <ProgramsPageClient />
    </Suspense>
  );
}

function ProgramsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-40 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

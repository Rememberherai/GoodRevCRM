import { Suspense } from 'react';
import { ContentLibraryPageClient } from './content-library-page-client';
import { Skeleton } from '@/components/ui/skeleton';

export default function ContentLibraryPage() {
  return (
    <Suspense fallback={<ContentLibrarySkeleton />}>
      <ContentLibraryPageClient />
    </Suspense>
  );
}

function ContentLibrarySkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 flex-1 max-w-sm" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-md border p-4">
            <Skeleton className="h-4 w-64 mb-2" />
            <Skeleton className="h-3 w-full mb-1" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { TemplatesPageClient } from './templates-page-client';

export default function TemplatesPage() {
  return (
    <Suspense fallback={<TemplatesPageSkeleton />}>
      <TemplatesPageClient />
    </Suspense>
  );
}

function TemplatesPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <Skeleton className="h-[480px] rounded-xl" />
    </div>
  );
}

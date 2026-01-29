import { Suspense } from 'react';
import { RfpDetailClient } from './rfp-detail-client';
import { Skeleton } from '@/components/ui/skeleton';

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function RfpDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<RfpDetailSkeleton />}>
      <RfpDetailClient rfpId={id} />
    </Suspense>
  );
}

function RfpDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-32" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-2 h-5 w-24" />
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    </div>
  );
}

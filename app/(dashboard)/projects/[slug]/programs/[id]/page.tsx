import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ProgramDetailClient } from './program-detail-client';

interface ProgramDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProgramDetailPage({ params }: ProgramDetailPageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<ProgramDetailSkeleton />}>
      <ProgramDetailClient programId={id} />
    </Suspense>
  );
}

function ProgramDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

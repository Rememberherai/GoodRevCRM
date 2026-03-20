import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { HouseholdDetailClient } from './household-detail-client';

interface HouseholdDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function HouseholdDetailPage({ params }: HouseholdDetailPageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<HouseholdDetailSkeleton />}>
      <HouseholdDetailClient householdId={id} />
    </Suspense>
  );
}

function HouseholdDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-40" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

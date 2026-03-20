import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ContractorDetailClient } from './contractor-detail-client';

interface ContractorDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ContractorDetailPage({ params }: ContractorDetailPageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<ContractorDetailSkeleton />}>
      <ContractorDetailClient contractorId={id} />
    </Suspense>
  );
}

function ContractorDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

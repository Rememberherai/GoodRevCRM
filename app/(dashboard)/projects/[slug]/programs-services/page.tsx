import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ProgramsServicesPageClient } from './programs-services-page-client';

export default function ProgramsServicesPage() {
  return (
    <Suspense fallback={<ProgramsServicesSkeleton />}>
      <ProgramsServicesPageClient />
    </Suspense>
  );
}

function ProgramsServicesSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-10 w-96" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

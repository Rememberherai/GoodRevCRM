import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { EmployeesPageClient } from '@/components/community/employees/employees-page-client';

export default function EmployeesPage() {
  return (
    <Suspense fallback={<EmployeesPageSkeleton />}>
      <EmployeesPageClient />
    </Suspense>
  );
}

function EmployeesPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

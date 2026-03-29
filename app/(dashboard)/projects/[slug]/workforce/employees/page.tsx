import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { EmployeesPageClient } from '@/components/community/employees/employees-page-client';

export default function EmployeesSubtabPage() {
  return (
    <Suspense fallback={<EmployeesSkeleton />}>
      <EmployeesPageClient />
    </Suspense>
  );
}

function EmployeesSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-[480px] rounded-xl" />
    </div>
  );
}

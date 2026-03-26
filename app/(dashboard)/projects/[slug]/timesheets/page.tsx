import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { TimesheetsPageClient } from '@/components/community/timesheets/timesheets-page-client';

export default function TimesheetsPage() {
  return (
    <Suspense fallback={<TimesheetsSkeleton />}>
      <TimesheetsPageClient />
    </Suspense>
  );
}

function TimesheetsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-12 rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

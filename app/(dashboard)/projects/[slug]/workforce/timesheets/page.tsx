import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { TimesheetsPageClient } from '@/components/community/timesheets/timesheets-page-client';

export default function TimesheetsSubtabPage() {
  return (
    <Suspense fallback={<TimesheetsSkeleton />}>
      <TimesheetsPageClient />
    </Suspense>
  );
}

function TimesheetsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-[480px] rounded-xl" />
    </div>
  );
}

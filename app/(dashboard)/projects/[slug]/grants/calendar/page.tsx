import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { GrantsCalendarClient } from '@/components/grants/calendar/grants-calendar-client';

function CalendarSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-80 w-full" />
    </div>
  );
}

export default function GrantsCalendarPage() {
  return (
    <Suspense fallback={<CalendarSkeleton />}>
      <GrantsCalendarClient />
    </Suspense>
  );
}

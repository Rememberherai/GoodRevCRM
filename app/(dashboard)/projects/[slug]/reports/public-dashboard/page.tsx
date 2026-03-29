import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { PublicDashboardSettingsClient } from '../../settings/public-dashboard/public-dashboard-settings-client';

export default function PublicDashboardSubtabPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <PublicDashboardSettingsClient />
    </Suspense>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-[480px] rounded-xl" />
    </div>
  );
}

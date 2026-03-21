import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { PublicDashboardSettingsClient } from './public-dashboard-settings-client';

export default function PublicDashboardSettingsPage() {
  return (
    <Suspense fallback={<PublicDashboardSettingsSkeleton />}>
      <PublicDashboardSettingsClient />
    </Suspense>
  );
}

function PublicDashboardSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-[560px] rounded-xl" />
    </div>
  );
}

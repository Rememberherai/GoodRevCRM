import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { AssetsPageClient } from '../../community-assets/assets-page-client';

export default function AssetsSubtabPage() {
  return (
    <Suspense fallback={<AssetsSkeleton />}>
      <AssetsPageClient />
    </Suspense>
  );
}

function AssetsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-[480px] rounded-xl" />
    </div>
  );
}

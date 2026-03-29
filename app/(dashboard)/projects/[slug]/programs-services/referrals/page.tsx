import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ReferralsPageClient } from '../../referrals/referrals-page-client';

export default function ReferralsSubtabPage() {
  return (
    <Suspense fallback={<ReferralsSkeleton />}>
      <ReferralsPageClient />
    </Suspense>
  );
}

function ReferralsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-[480px] rounded-xl" />
    </div>
  );
}

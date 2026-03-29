import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { TemplatesPageClient } from '../../templates/templates-page-client';

export default function CommunicationsTemplatesPage() {
  return (
    <Suspense fallback={<TemplatesSkeleton />}>
      <TemplatesPageClient />
    </Suspense>
  );
}

function TemplatesSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-[480px] rounded-xl" />
    </div>
  );
}

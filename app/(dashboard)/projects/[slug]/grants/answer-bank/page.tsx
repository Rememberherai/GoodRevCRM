import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { AnswerBankPageClient } from '@/components/grants/answer-bank/answer-bank-page-client';

function AnswerBankSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    </div>
  );
}

export default function AnswerBankPage() {
  return (
    <Suspense fallback={<AnswerBankSkeleton />}>
      <AnswerBankPageClient />
    </Suspense>
  );
}

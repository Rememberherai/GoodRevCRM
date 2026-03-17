import { Suspense } from 'react';
import { FieldEditorClient } from './field-editor-client';
import { Skeleton } from '@/components/ui/skeleton';

export default function FieldEditorPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
      <FieldEditorClient />
    </Suspense>
  );
}

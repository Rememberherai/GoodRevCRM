'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer } from 'lucide-react';

export function PrintActions() {
  const router = useRouter();

  return (
    <div className="no-print mb-6 flex items-center justify-between">
      <Button variant="ghost" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to RFP
      </Button>
      <Button onClick={() => window.print()}>
        <Printer className="mr-2 h-4 w-4" />
        Print / Save as PDF
      </Button>
    </div>
  );
}

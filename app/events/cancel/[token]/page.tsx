'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function CancelPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);

  async function handleCancel() {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/events/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel_token: token }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setIsCancelled(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isCancelled) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
          <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="mb-2 text-2xl font-bold">Registration Cancelled</h1>
        <p className="text-muted-foreground">Your registration has been cancelled.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 text-center space-y-4">
          <h1 className="text-xl font-bold">Cancel Registration</h1>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to cancel your registration? This action cannot be undone.
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={isSubmitting}>
              {isSubmitting ? 'Cancelling...' : 'Yes, Cancel'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

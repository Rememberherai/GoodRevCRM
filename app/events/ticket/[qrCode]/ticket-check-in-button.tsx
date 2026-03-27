'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface TicketCheckInButtonProps {
  qrCode: string;
  registrantName: string;
}

export function TicketCheckInButton({ qrCode, registrantName }: TicketCheckInButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);

  async function handleCheckIn() {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/events/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_code: qrCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check-in failed');
      setCheckedIn(true);
      toast.success(`${registrantName} checked in!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Check-in failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (checkedIn) {
    return (
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <Badge variant="outline" className="text-green-700 dark:text-green-400 text-base px-4 py-1">
            Checked In
          </Badge>
        </div>
        <p className="text-sm font-medium text-green-700 dark:text-green-400">{registrantName}</p>
      </div>
    );
  }

  return (
    <Button
      className="w-full"
      size="lg"
      onClick={handleCheckIn}
      disabled={isSubmitting}
    >
      {isSubmitting ? 'Checking in...' : `Check In ${registrantName}`}
    </Button>
  );
}

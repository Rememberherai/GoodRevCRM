'use client';

import { Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTelnyx } from '@/providers/telnyx-provider';
import { useCallStore } from '@/stores/call';
import { toast } from 'sonner';

interface ClickToDialButtonProps {
  phoneNumber: string;
  personId?: string;
  organizationId?: string;
  size?: 'sm' | 'icon';
  variant?: 'ghost' | 'outline';
}

export function ClickToDialButton({
  phoneNumber,
  personId,
  organizationId,
  size = 'icon',
  variant = 'ghost',
}: ClickToDialButtonProps) {
  const { isConnected, makeCall, hasConnection } = useTelnyx();
  const callState = useCallStore((s) => s.callState);

  if (!hasConnection) return null;

  const isCallActive = callState !== 'idle';

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isConnected) {
      toast.error('Phone not connected. Check your Telnyx settings.');
      return;
    }

    if (isCallActive) {
      toast.error('A call is already in progress');
      return;
    }

    try {
      await makeCall(phoneNumber, personId, organizationId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start call');
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={!isConnected || isCallActive}
      title={
        !isConnected
          ? 'Phone not connected'
          : isCallActive
            ? 'Call in progress'
            : `Call ${phoneNumber}`
      }
      className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
    >
      <Phone className="h-3.5 w-3.5" />
    </Button>
  );
}

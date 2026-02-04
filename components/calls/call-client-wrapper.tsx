'use client';

import { TelnyxProvider } from '@/providers/telnyx-provider';
import { DialerWidget } from './dialer-widget';
import { CallDispositionModal } from './call-disposition-modal';

interface CallClientWrapperProps {
  children: React.ReactNode;
}

export function CallClientWrapper({ children }: CallClientWrapperProps) {
  return (
    <TelnyxProvider>
      {children}
      <DialerWidget />
      <CallDispositionModal />
    </TelnyxProvider>
  );
}

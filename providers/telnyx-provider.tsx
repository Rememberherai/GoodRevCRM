'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useState,
  type ReactNode,
} from 'react';
import { useParams } from 'next/navigation';
import { useCallStore } from '@/stores/call';

// TelnyxRTC types (dynamic import to avoid SSR issues)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TelnyxRTCClient = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TelnyxCall = any;

export type CallState = 'idle' | 'connecting' | 'ringing' | 'active' | 'ending';

interface TelnyxContextValue {
  isConnected: boolean;
  isConnecting: boolean;
  callState: CallState;
  activeCall: TelnyxCall | null;
  isMuted: boolean;
  isOnHold: boolean;
  makeCall: (toNumber: string, personId?: string, organizationId?: string) => Promise<void>;
  hangUp: () => void;
  toggleMute: () => void;
  toggleHold: () => void;
  sendDTMF: (digit: string) => void;
  hasConnection: boolean;
}

const TelnyxContext = createContext<TelnyxContextValue>({
  isConnected: false,
  isConnecting: false,
  callState: 'idle',
  activeCall: null,
  isMuted: false,
  isOnHold: false,
  makeCall: async () => {},
  hangUp: () => {},
  toggleMute: () => {},
  toggleHold: () => {},
  sendDTMF: () => {},
  hasConnection: false,
});

export function useTelnyx() {
  return useContext(TelnyxContext);
}

interface TelnyxProviderProps {
  children: ReactNode;
}

export function TelnyxProvider({ children }: TelnyxProviderProps) {
  const params = useParams();
  const slug = params?.slug as string | undefined;
  const clientRef = useRef<TelnyxRTCClient | null>(null);
  const callRef = useRef<TelnyxCall | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [callState, setCallState] = useState<CallState>('idle');
  const [activeCall, setActiveCall] = useState<TelnyxCall | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [hasConnection, setHasConnection] = useState(false);

  const {
    setCallState: setStoreCallState,
    setActiveCall: setStoreActiveCall,
    openDispositionModal,
    incrementTimer,
  } = useCallStore();

  // Start call timer
  const startTimer = useCallback(() => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => {
      incrementTimer();
    }, 1000);
  }, [incrementTimer]);

  const stopTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  }, []);

  // Initialize TelnyxRTC client
  useEffect(() => {
    if (!slug) return;

    let mounted = true;

    async function initClient() {
      try {
        setIsConnecting(true);

        // Fetch WebRTC credentials
        const res = await fetch(`/api/projects/${slug}/telnyx/webrtc-token`);
        if (!res.ok) {
          setHasConnection(false);
          setIsConnecting(false);
          return;
        }

        const { username, password } = await res.json();
        setHasConnection(true);

        // Dynamically import TelnyxRTC to avoid SSR issues
        const { TelnyxRTC } = await import('@telnyx/webrtc');

        const client = new TelnyxRTC({
          login: username,
          password: password,
        });

        client.on('telnyx.ready', () => {
          if (mounted) {
            setIsConnected(true);
            setIsConnecting(false);
          }
        });

        client.on('telnyx.error', (error: unknown) => {
          console.error('TelnyxRTC error:', error);
          if (mounted) {
            setIsConnected(false);
            setIsConnecting(false);
          }
        });

        client.on('telnyx.socket.close', () => {
          if (mounted) {
            setIsConnected(false);
          }
        });

        client.on('telnyx.notification', (notification: { call?: TelnyxCall }) => {
          if (!mounted || !notification.call) return;

          const call = notification.call;
          callRef.current = call;
          setActiveCall(call);

          call.on('stateChange', (state: { state: string }) => {
            if (!mounted) return;

            switch (state.state) {
              case 'trying':
              case 'requesting':
                setCallState('connecting');
                setStoreCallState('connecting');
                break;
              case 'ringing':
              case 'early':
                setCallState('ringing');
                setStoreCallState('ringing');
                break;
              case 'active':
                setCallState('active');
                setStoreCallState('active');
                startTimer();
                break;
              case 'hangup':
              case 'destroy':
                setCallState('idle');
                setStoreCallState('idle');
                setActiveCall(null);
                callRef.current = null;
                setIsMuted(false);
                setIsOnHold(false);
                stopTimer();
                // Open disposition modal
                openDispositionModal();
                break;
            }
          });
        });

        client.connect();
        clientRef.current = client;
      } catch (err) {
        console.error('Error initializing TelnyxRTC:', err);
        if (mounted) {
          setIsConnecting(false);
        }
      }
    }

    initClient();

    return () => {
      mounted = false;
      stopTimer();
      if (clientRef.current) {
        try {
          clientRef.current.disconnect();
        } catch { /* ignore cleanup errors */ }
        clientRef.current = null;
      }
    };
  }, [slug, setStoreCallState, startTimer, stopTimer, openDispositionModal]);

  const makeCall = useCallback(
    async (toNumber: string, personId?: string, organizationId?: string) => {
      if (!clientRef.current || !isConnected || callState !== 'idle') return;

      try {
        // Create call record in the backend
        const res = await fetch(`/api/projects/${slug}/calls`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to_number: toNumber,
            person_id: personId ?? null,
            organization_id: organizationId ?? null,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to initiate call');
        }

        const { callId, callControlId } = await res.json();

        // Store call info
        setStoreActiveCall(callId, {
          id: callId,
          telnyx_call_control_id: callControlId,
          to_number: toNumber,
          person_id: personId ?? null,
          organization_id: organizationId ?? null,
          direction: 'outbound',
          status: 'initiated',
        });

        // The actual WebRTC call is initiated server-side via the Telnyx API.
        // The Telnyx platform bridges the call to the browser via the SIP connection.
        // The browser client receives the call notification via the telnyx.notification event.
        setCallState('connecting');
        setStoreCallState('connecting');
      } catch (err) {
        console.error('Error making call:', err);
        setCallState('idle');
        setStoreCallState('idle');
        throw err;
      }
    },
    [isConnected, callState, slug, setStoreActiveCall, setStoreCallState]
  );

  const hangUp = useCallback(() => {
    if (callRef.current) {
      try {
        callRef.current.hangup();
      } catch { /* ignore */ }
    }
    // Also send hangup via API as backup
    const store = useCallStore.getState();
    if (store.activeCallId && slug) {
      fetch(`/api/projects/${slug}/calls/${store.activeCallId}/hangup`, {
        method: 'POST',
      }).catch(() => {});
    }
  }, [slug]);

  const toggleMute = useCallback(() => {
    if (!callRef.current) return;
    if (isMuted) {
      callRef.current.unmuteAudio();
    } else {
      callRef.current.muteAudio();
    }
    setIsMuted(!isMuted);
  }, [isMuted]);

  const toggleHold = useCallback(() => {
    if (!callRef.current) return;
    if (isOnHold) {
      callRef.current.unhold();
    } else {
      callRef.current.hold();
    }
    setIsOnHold(!isOnHold);
  }, [isOnHold]);

  const sendDTMF = useCallback((digit: string) => {
    if (!callRef.current) return;
    callRef.current.dtmf(digit);
  }, []);

  return (
    <TelnyxContext.Provider
      value={{
        isConnected,
        isConnecting,
        callState,
        activeCall,
        isMuted,
        isOnHold,
        makeCall,
        hangUp,
        toggleMute,
        toggleHold,
        sendDTMF,
        hasConnection,
      }}
    >
      {children}
    </TelnyxContext.Provider>
  );
}

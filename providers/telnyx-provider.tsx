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

interface TelnyxContextValue {
  isConnected: boolean;
  isConnecting: boolean;
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

  // Local state for WebRTC connection status (not call state)
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasConnection, setHasConnection] = useState(false);

  // Use Zustand store for all call state
  const {
    callState,
    isMuted,
    isOnHold,
    setCallState,
    setActiveCall,
    setMuted,
    setOnHold,
    clearActiveCall,
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

        // Create hidden audio element for call audio
        let audioEl = document.getElementById('telnyx-remote-audio') as HTMLAudioElement;
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.id = 'telnyx-remote-audio';
          audioEl.autoplay = true;
          document.body.appendChild(audioEl);
        }

        const client = new TelnyxRTC({
          login: username,
          password: password,
        });

        // Set the audio element for remote audio
        client.remoteElement = 'telnyx-remote-audio';

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

        client.on('telnyx.notification', (notification: { type?: string; call?: TelnyxCall }) => {
          if (!mounted) return;

          // Log all notification types for debugging
          console.log('Telnyx notification:', notification.type, notification.call?.state);

          // Handle call updates
          if (notification.type === 'callUpdate' && notification.call) {
            const call = notification.call;
            callRef.current = call;

            const state = call.state;
            console.log('Call state update:', state);

            // Try to get Telnyx IDs from the call for webhook linking
            try {
              const telnyxIds = call.telnyxIDs;
              if (telnyxIds?.telnyxCallControlId) {
                const store = useCallStore.getState();
                if (store.activeCallId && store.currentCallRecord?.telnyx_call_control_id !== telnyxIds.telnyxCallControlId) {
                  // Update the store with the Telnyx ID
                  store.updateCallRecord({ telnyx_call_control_id: telnyxIds.telnyxCallControlId });

                  // Update backend with Telnyx call control ID for webhook linking
                  fetch(`/api/projects/${slug}/calls/${store.activeCallId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      telnyx_call_control_id: telnyxIds.telnyxCallControlId,
                      telnyx_call_leg_id: telnyxIds.telnyxLegId,
                      telnyx_call_session_id: telnyxIds.telnyxSessionId,
                    }),
                  }).catch((err) => console.error('Error updating call with Telnyx IDs:', err));
                }
              }
            } catch {
              // telnyxIDs getter may not be available in all states
            }

            switch (state) {
              case 'trying':
              case 'requesting':
              case 'new':
              case 'recovering':
                setCallState('connecting');
                break;
              case 'ringing':
              case 'early':
                setCallState('ringing');
                break;
              case 'active':
              case 'answering':
                setCallState('active');
                startTimer();
                // Start recording if enabled (fire-and-forget)
                {
                  const store = useCallStore.getState();
                  if (store.activeCallId && store.currentCallRecord?.telnyx_call_control_id) {
                    fetch(`/api/projects/${slug}/calls/${store.activeCallId}/record`, {
                      method: 'POST',
                    }).catch((err) => console.log('Recording start skipped or failed:', err));
                  }
                }
                break;
              case 'held':
                // Call is on hold - don't change our state, just log
                console.log('Call placed on hold');
                break;
              case 'hangup':
              case 'destroy':
              case 'done':
              case 'purge':
                console.log('Call ended with state:', state, 'cause:', call.cause, 'causeCode:', call.causeCode);
                callRef.current = null;
                stopTimer();
                // Open disposition modal before clearing state
                openDispositionModal();
                break;
              default:
                // Log unknown states for debugging
                console.log('Unknown call state:', state);
            }
          }
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
  }, [slug, setCallState, clearActiveCall, startTimer, stopTimer, openDispositionModal]);

  const makeCall = useCallback(
    async (toNumber: string, personId?: string, organizationId?: string) => {
      if (!clientRef.current || !isConnected || callState !== 'idle') return;

      try {
        // First, create call record in the backend to track it
        const res = await fetch(`/api/projects/${slug}/calls/webrtc`, {
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

        const { callId, fromNumber } = await res.json();

        // Store call info in Zustand
        setActiveCall(callId, {
          id: callId,
          telnyx_call_control_id: null,
          to_number: toNumber,
          person_id: personId ?? null,
          organization_id: organizationId ?? null,
          direction: 'outbound',
          status: 'initiated',
        });

        setCallState('connecting');

        // Initiate the call via WebRTC SDK (this handles audio in browser)
        // The call state changes are handled by the telnyx.notification listener
        // that was set up in the useEffect
        const call = clientRef.current.newCall({
          destinationNumber: toNumber,
          callerNumber: fromNumber,
          audio: true,
          video: false,
        });

        callRef.current = call;
      } catch (err) {
        console.error('Error making call:', err);
        setCallState('idle');
        throw err;
      }
    },
    [isConnected, callState, slug, setActiveCall, setCallState, startTimer, stopTimer, openDispositionModal]
  );

  const hangUp = useCallback(() => {
    const store = useCallStore.getState();

    // Set state to ending immediately for UI feedback
    setCallState('ending');

    // Try local SDK hangup first
    if (callRef.current) {
      try {
        callRef.current.hangup();
      } catch { /* ignore */ }
    }

    // Update call status in DB directly (don't rely on Telnyx API hangup which needs call_control_id)
    if (store.activeCallId && slug) {
      fetch(`/api/projects/${slug}/calls/${store.activeCallId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'hangup',
          ended_at: new Date().toISOString(),
        }),
      }).catch((err) => console.error('Error updating call status:', err));
    }

    // Clear call ref and open disposition modal after brief delay
    // (gives SDK time to process hangup notification)
    setTimeout(() => {
      callRef.current = null;
      stopTimer();
      openDispositionModal();
    }, 500);
  }, [slug, setCallState, stopTimer, openDispositionModal]);

  const toggleMute = useCallback(() => {
    if (!callRef.current) return;
    if (isMuted) {
      callRef.current.unmuteAudio();
    } else {
      callRef.current.muteAudio();
    }
    setMuted(!isMuted);
  }, [isMuted, setMuted]);

  const toggleHold = useCallback(() => {
    if (!callRef.current) return;
    if (isOnHold) {
      callRef.current.unhold();
    } else {
      callRef.current.hold();
    }
    setOnHold(!isOnHold);
  }, [isOnHold, setOnHold]);

  const sendDTMF = useCallback((digit: string) => {
    if (!callRef.current) return;
    callRef.current.dtmf(digit);
  }, []);

  return (
    <TelnyxContext.Provider
      value={{
        isConnected,
        isConnecting,
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

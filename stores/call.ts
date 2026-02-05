import { create } from 'zustand';

// Call state types - defined here to avoid circular dependency with provider
export type CallState = 'idle' | 'connecting' | 'ringing' | 'active' | 'ending';

interface CallRecord {
  id: string;
  telnyx_call_control_id?: string | null;
  to_number: string;
  person_id?: string | null;
  organization_id?: string | null;
  direction: string;
  status: string;
}

interface CallStoreState {
  // Active call
  activeCallId: string | null;
  currentCallRecord: CallRecord | null;
  callState: CallState;
  callTimer: number; // seconds

  // Call controls state
  isMuted: boolean;
  isOnHold: boolean;

  // UI state
  showDispositionModal: boolean;
  showDialer: boolean;
  lastEndedCallId: string | null;

  // Actions
  setActiveCall: (callId: string, record: CallRecord) => void;
  updateCallRecord: (updates: Partial<CallRecord>) => void;
  clearActiveCall: () => void;
  setCallState: (state: CallState) => void;
  incrementTimer: () => void;
  setMuted: (muted: boolean) => void;
  setOnHold: (onHold: boolean) => void;
  openDispositionModal: () => void;
  closeDispositionModal: () => void;
  toggleDialer: () => void;
  setShowDialer: (show: boolean) => void;
}

export const useCallStore = create<CallStoreState>((set, get) => ({
  activeCallId: null,
  currentCallRecord: null,
  callState: 'idle',
  callTimer: 0,
  isMuted: false,
  isOnHold: false,
  showDispositionModal: false,
  showDialer: false,
  lastEndedCallId: null,

  setActiveCall: (callId, record) =>
    set({
      activeCallId: callId,
      currentCallRecord: record,
      callTimer: 0,
      isMuted: false,
      isOnHold: false,
    }),

  updateCallRecord: (updates) =>
    set((state) => ({
      currentCallRecord: state.currentCallRecord
        ? { ...state.currentCallRecord, ...updates }
        : null,
    })),

  clearActiveCall: () =>
    set({
      activeCallId: null,
      currentCallRecord: null,
      callState: 'idle',
      callTimer: 0,
      isMuted: false,
      isOnHold: false,
    }),

  setCallState: (state) => set({ callState: state }),

  incrementTimer: () => set((s) => ({ callTimer: s.callTimer + 1 })),

  setMuted: (muted) => set({ isMuted: muted }),

  setOnHold: (onHold) => set({ isOnHold: onHold }),

  openDispositionModal: () => {
    const { activeCallId } = get();
    set({
      showDispositionModal: true,
      lastEndedCallId: activeCallId,
    });
  },

  closeDispositionModal: () =>
    set({
      showDispositionModal: false,
      lastEndedCallId: null,
      activeCallId: null,
      currentCallRecord: null,
      callTimer: 0,
      isMuted: false,
      isOnHold: false,
    }),

  toggleDialer: () => set((s) => ({ showDialer: !s.showDialer })),

  setShowDialer: (show) => set({ showDialer: show }),
}));

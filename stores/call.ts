import { create } from 'zustand';
import type { CallState } from '@/providers/telnyx-provider';

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

  // UI state
  showDispositionModal: boolean;
  showDialer: boolean;
  lastEndedCallId: string | null;

  // Actions
  setActiveCall: (callId: string, record: CallRecord) => void;
  clearActiveCall: () => void;
  setCallState: (state: CallState) => void;
  incrementTimer: () => void;
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
  showDispositionModal: false,
  showDialer: false,
  lastEndedCallId: null,

  setActiveCall: (callId, record) =>
    set({
      activeCallId: callId,
      currentCallRecord: record,
      callTimer: 0,
    }),

  clearActiveCall: () =>
    set({
      activeCallId: null,
      currentCallRecord: null,
      callState: 'idle',
      callTimer: 0,
    }),

  setCallState: (state) => set({ callState: state }),

  incrementTimer: () => set((s) => ({ callTimer: s.callTimer + 1 })),

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
    }),

  toggleDialer: () => set((s) => ({ showDialer: !s.showDialer })),

  setShowDialer: (show) => set({ showDialer: show }),
}));

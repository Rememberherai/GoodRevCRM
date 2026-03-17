import { create } from 'zustand';

export interface ChatConversation {
  id: string;
  title: string | null;
  model: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }> | null;
  tool_call_id?: string | null;
  tool_name?: string | null;
  created_at: string;
}

export interface ToolCallEvent {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
  status: 'pending' | 'complete' | 'error';
}

interface ChatState {
  isOpen: boolean;
  conversations: ChatConversation[];
  currentConversationId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  pendingToolCalls: ToolCallEvent[];
  error: string | null;
  panelWidth: number;

  toggle: () => void;
  open: () => void;
  close: () => void;
  setConversations: (convos: ChatConversation[]) => void;
  setCurrentConversation: (id: string | null) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  addMessage: (msg: ChatMessage) => void;
  appendStreamingContent: (delta: string) => void;
  resetStreamingContent: () => void;
  addToolCall: (tc: ToolCallEvent) => void;
  updateToolCallResult: (id: string, result: string, status: 'complete' | 'error') => void;
  clearToolCalls: () => void;
  setStreaming: (val: boolean) => void;
  setError: (err: string | null) => void;
  setPanelWidth: (width: number) => void;
  reset: () => void;
}

const DEFAULT_WIDTH = 480;
const STORAGE_KEY = 'goodrev-chat-panel-width';

function getStoredWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_WIDTH;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? Math.max(360, Math.min(800, parseInt(stored, 10))) : DEFAULT_WIDTH;
}

export const useChatStore = create<ChatState>((set) => ({
  isOpen: false,
  conversations: [],
  currentConversationId: null,
  messages: [],
  isStreaming: false,
  streamingContent: '',
  pendingToolCalls: [],
  error: null,
  panelWidth: DEFAULT_WIDTH,

  toggle: () => set((s) => {
    const newOpen = !s.isOpen;
    if (newOpen && s.panelWidth === DEFAULT_WIDTH) {
      return { isOpen: newOpen, panelWidth: getStoredWidth() };
    }
    return { isOpen: newOpen };
  }),
  open: () => set({ isOpen: true, panelWidth: getStoredWidth() }),
  close: () => set({ isOpen: false }),
  setConversations: (conversations) => set({ conversations }),
  setCurrentConversation: (id) => set({ currentConversationId: id, messages: [], streamingContent: '', pendingToolCalls: [], error: null, isStreaming: false }),
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  appendStreamingContent: (delta) => set((s) => ({ streamingContent: s.streamingContent + delta })),
  resetStreamingContent: () => set({ streamingContent: '' }),
  addToolCall: (tc) => set((s) => ({ pendingToolCalls: [...s.pendingToolCalls, tc] })),
  updateToolCallResult: (id, result, status) =>
    set((s) => ({
      pendingToolCalls: s.pendingToolCalls.map((tc) =>
        tc.id === id ? { ...tc, result, status } : tc
      ),
    })),
  clearToolCalls: () => set({ pendingToolCalls: [] }),
  setStreaming: (isStreaming) => set({ isStreaming }),
  setError: (error) => set({ error }),
  setPanelWidth: (width) => {
    const clamped = Math.max(360, Math.min(800, width));
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, String(clamped));
    set({ panelWidth: clamped });
  },
  reset: () => set({
    currentConversationId: null,
    messages: [],
    streamingContent: '',
    pendingToolCalls: [],
    error: null,
    isStreaming: false,
  }),
}));

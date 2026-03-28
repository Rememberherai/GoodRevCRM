import { create } from 'zustand';
import { arrayMove } from '@dnd-kit/sortable';
import type { EmailDesign, EmailBlock, BlockId, EmailGlobalStyles } from '@/types/email-builder';
import { createDefaultDesign } from '@/lib/email-builder/default-blocks';

// ── Debounced history push (prevents undo flooding on text input) ────────
// On the first call in a burst, we immediately snapshot the current state
// (before the mutation). Subsequent calls within the debounce window skip
// the snapshot. When the timer fires, it clears the burst flag so the next
// edit series gets a fresh snapshot.

let historyTimer: ReturnType<typeof setTimeout> | null = null;
let debounceBurstActive = false;

function debouncedPushHistory(pushFn: () => void, delay = 500) {
  if (!debounceBurstActive) {
    debounceBurstActive = true;
    pushFn();
  }
  if (historyTimer) clearTimeout(historyTimer);
  historyTimer = setTimeout(() => {
    debounceBurstActive = false;
  }, delay);
}

const MAX_HISTORY = 50;

// ── Store types ─────────────────────────────────────────────────────────

interface EmailBuilderState {
  // Core data
  design: EmailDesign;

  // Selection
  selectedBlockId: BlockId | null;

  // Drag state
  activeBlockId: BlockId | null;
  dragSource: 'palette' | 'canvas' | null;

  // Undo/redo
  undoStack: EmailDesign[];
  redoStack: EmailDesign[];

  // Dirty tracking
  lastSavedDesign: EmailDesign | null;

  // UI
  previewMode: 'desktop' | 'mobile';
  sidePanel: 'blocks' | 'styles';
}

interface EmailBuilderActions {
  // Initialization
  loadDesign: (design: EmailDesign) => void;
  resetDesign: () => void;

  // Block CRUD
  addBlock: (block: EmailBlock, index?: number) => void;
  removeBlock: (blockId: BlockId) => void;
  updateBlock: (blockId: BlockId, patch: Partial<EmailBlock>) => void;
  updateBlockDebounced: (blockId: BlockId, patch: Partial<EmailBlock>) => void;
  moveBlock: (fromIndex: number, toIndex: number) => void;
  duplicateBlock: (blockId: BlockId) => void;

  // Global styles
  updateGlobalStyles: (patch: Partial<EmailGlobalStyles>) => void;

  // Selection
  selectBlock: (blockId: BlockId | null) => void;

  // Drag
  setActiveBlock: (blockId: BlockId | null, source: 'palette' | 'canvas' | null) => void;

  // Undo/redo
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Save tracking
  markSaved: () => void;
  hasUnsavedChanges: () => boolean;

  // UI
  setPreviewMode: (mode: 'desktop' | 'mobile') => void;
  setSidePanel: (panel: 'blocks' | 'styles') => void;

  // Helpers
  getBlockById: (blockId: BlockId) => EmailBlock | undefined;
}

// ── Store ────────────────────────────────────────────────────────────────

export const useEmailBuilderStore = create<EmailBuilderState & EmailBuilderActions>(
  (set, get) => ({
    // ── Initial state ───────────────────────────────────────────────
    design: createDefaultDesign(),
    selectedBlockId: null,
    activeBlockId: null,
    dragSource: null,
    undoStack: [],
    redoStack: [],
    lastSavedDesign: null,
    previewMode: 'desktop',
    sidePanel: 'blocks',

    // ── Initialization ──────────────────────────────────────────────

    loadDesign: (design) => {
      // Clear debounce state so the next edit gets a clean history snapshot
      if (historyTimer) { clearTimeout(historyTimer); historyTimer = null; }
      debounceBurstActive = false;
      set({
        design,
        selectedBlockId: null,
        undoStack: [],
        redoStack: [],
        lastSavedDesign: structuredClone(design),
      });
    },

    resetDesign: () => {
      if (historyTimer) { clearTimeout(historyTimer); historyTimer = null; }
      debounceBurstActive = false;
      const fresh = createDefaultDesign();
      set({
        design: fresh,
        selectedBlockId: null,
        undoStack: [],
        redoStack: [],
        lastSavedDesign: null,
      });
    },

    // ── History ─────────────────────────────────────────────────────

    pushHistory: () => {
      const { design, undoStack } = get();
      const snapshot = structuredClone(design);
      const newStack = [...undoStack, snapshot];
      if (newStack.length > MAX_HISTORY) newStack.shift();
      set({ undoStack: newStack, redoStack: [] });
    },

    undo: () => {
      const { undoStack, design } = get();
      if (undoStack.length === 0) return;
      const prev = undoStack[undoStack.length - 1];
      set({
        design: prev,
        undoStack: undoStack.slice(0, -1),
        redoStack: [...get().redoStack, structuredClone(design)],
        selectedBlockId: null,
      });
    },

    redo: () => {
      const { redoStack, design } = get();
      if (redoStack.length === 0) return;
      const next = redoStack[redoStack.length - 1];
      set({
        design: next,
        redoStack: redoStack.slice(0, -1),
        undoStack: [...get().undoStack, structuredClone(design)],
        selectedBlockId: null,
      });
    },

    canUndo: () => get().undoStack.length > 0,
    canRedo: () => get().redoStack.length > 0,

    // ── Block CRUD ──────────────────────────────────────────────────

    addBlock: (block, index) => {
      get().pushHistory();
      const { design } = get();
      const blocks = [...design.blocks];
      if (index !== undefined && index >= 0 && index <= blocks.length) {
        blocks.splice(index, 0, block);
      } else {
        blocks.push(block);
      }
      set({
        design: { ...design, blocks },
        selectedBlockId: block.id,
        sidePanel: 'styles',
      });
    },

    removeBlock: (blockId) => {
      get().pushHistory();
      const { design, selectedBlockId } = get();
      set({
        design: {
          ...design,
          blocks: design.blocks.filter((b) => b.id !== blockId),
        },
        selectedBlockId: selectedBlockId === blockId ? null : selectedBlockId,
      });
    },

    updateBlock: (blockId, patch) => {
      get().pushHistory();
      const { design } = get();
      set({
        design: {
          ...design,
          blocks: design.blocks.map((b) =>
            b.id === blockId ? ({ ...b, ...patch } as EmailBlock) : b
          ),
        },
      });
    },

    updateBlockDebounced: (blockId, patch) => {
      // For text edits — debounce the history push
      debouncedPushHistory(() => get().pushHistory());
      const { design } = get();
      set({
        design: {
          ...design,
          blocks: design.blocks.map((b) =>
            b.id === blockId ? ({ ...b, ...patch } as EmailBlock) : b
          ),
        },
      });
    },

    moveBlock: (fromIndex, toIndex) => {
      if (fromIndex === toIndex) return;
      get().pushHistory();
      const { design } = get();
      set({
        design: {
          ...design,
          blocks: arrayMove(design.blocks, fromIndex, toIndex),
        },
      });
    },

    duplicateBlock: (blockId) => {
      const { design } = get();
      const block = design.blocks.find((b) => b.id === blockId);
      if (!block) return;
      const index = design.blocks.indexOf(block);
      const clone: EmailBlock = {
        ...structuredClone(block),
        id: crypto.randomUUID(),
      } as EmailBlock;
      get().addBlock(clone, index + 1);
    },

    // ── Global styles ───────────────────────────────────────────────

    updateGlobalStyles: (patch) => {
      get().pushHistory();
      const { design } = get();
      set({
        design: {
          ...design,
          globalStyles: { ...design.globalStyles, ...patch },
        },
      });
    },

    // ── Selection ───────────────────────────────────────────────────

    selectBlock: (blockId) => {
      set({
        selectedBlockId: blockId,
        sidePanel: blockId ? 'styles' : 'blocks',
      });
    },

    // ── Drag ────────────────────────────────────────────────────────

    setActiveBlock: (blockId, source) => {
      set({ activeBlockId: blockId, dragSource: source });
    },

    // ── Save tracking ───────────────────────────────────────────────

    markSaved: () => {
      set({ lastSavedDesign: structuredClone(get().design) });
    },

    hasUnsavedChanges: () => {
      const { design, lastSavedDesign } = get();
      if (!lastSavedDesign) return design.blocks.length > 0;
      return JSON.stringify(design) !== JSON.stringify(lastSavedDesign);
    },

    // ── UI ──────────────────────────────────────────────────────────

    setPreviewMode: (mode) => set({ previewMode: mode }),
    setSidePanel: (panel) => set({ sidePanel: panel }),

    // ── Helpers ─────────────────────────────────────────────────────

    getBlockById: (blockId) => get().design.blocks.find((b) => b.id === blockId),
  })
);

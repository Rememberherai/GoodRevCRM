import { create } from 'zustand';
import type {
  WorkflowNode,
  WorkflowEdge,
  WorkflowDefinition,
  WorkflowValidationError,
} from '@/types/workflow';
import { WORKFLOW_SCHEMA_VERSION } from '@/types/workflow';

// ── History snapshot for undo/redo ──────────────────────────────────────
interface HistorySnapshot {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

const MAX_HISTORY = 50;

// ── Clipboard for copy/paste ────────────────────────────────────────────
interface ClipboardData {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

interface WorkflowStoreState {
  // Workflow metadata
  workflowId: string | null;
  workflowName: string;
  workflowDescription: string;
  isActive: boolean;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  tags: string[];
  currentVersion: number;

  // Graph state (ReactFlow)
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];

  // Sub-workflow support (like cc-wf-studio's SubAgentFlow)
  activeSubWorkflowId: string | null;
  mainWorkflowSnapshot: { nodes: WorkflowNode[]; edges: WorkflowEdge[] } | null;

  // UI state
  selectedNodeId: string | null;
  propertyPanelOpen: boolean;
  minimapVisible: boolean;
  palettePanelOpen: boolean;

  // Dirty tracking
  lastSavedDefinition: WorkflowDefinition | null;
  lastSavedMeta: { name: string; description: string; triggerType: string; triggerConfig: string; tags: string } | null;

  // Validation
  validationErrors: WorkflowValidationError[];

  // Loading
  isLoading: boolean;
  isSaving: boolean;

  // Undo/redo
  undoStack: HistorySnapshot[];
  redoStack: HistorySnapshot[];

  // Clipboard
  clipboard: ClipboardData | null;
}

interface WorkflowStoreActions {
  // Workflow operations
  loadWorkflow: (workflow: {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    trigger_type: string;
    trigger_config: Record<string, unknown>;
    definition: WorkflowDefinition;
    tags: string[];
    current_version: number;
  }) => void;
  clearWorkflow: () => void;
  setWorkflowName: (name: string) => void;
  setWorkflowDescription: (desc: string) => void;
  setTriggerType: (type: string) => void;
  setTriggerConfig: (config: Record<string, unknown>) => void;
  setTags: (tags: string[]) => void;

  // Node operations
  addNode: (node: WorkflowNode) => void;
  removeNode: (id: string) => void;
  updateNodeData: (id: string, data: Partial<WorkflowNode['data']>) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  setNodes: (nodes: WorkflowNode[]) => void;

  // Edge operations
  addEdge: (edge: WorkflowEdge) => void;
  removeEdge: (id: string) => void;
  setEdges: (edges: WorkflowEdge[]) => void;

  // Sub-workflow support
  enterSubWorkflow: (nodeId: string, definition: WorkflowDefinition) => void;
  exitSubWorkflow: () => void;

  // UI state
  setSelectedNodeId: (id: string | null) => void;
  setPropertyPanelOpen: (open: boolean) => void;
  setMinimapVisible: (visible: boolean) => void;
  setPalettePanelOpen: (open: boolean) => void;

  // Save tracking
  markSaved: () => void;
  hasUnsavedChanges: () => boolean;

  // Validation
  setValidationErrors: (errors: WorkflowValidationError[]) => void;

  // Loading
  setIsLoading: (loading: boolean) => void;
  setIsSaving: (saving: boolean) => void;

  // Get current definition
  getDefinition: () => WorkflowDefinition;

  // Undo/redo
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Copy/paste
  copySelectedNodes: () => void;
  pasteNodes: () => void;
}

const initialState: WorkflowStoreState = {
  workflowId: null,
  workflowName: '',
  workflowDescription: '',
  isActive: false,
  triggerType: 'manual',
  triggerConfig: {},
  tags: [],
  currentVersion: 1,
  nodes: [],
  edges: [],
  activeSubWorkflowId: null,
  mainWorkflowSnapshot: null,
  selectedNodeId: null,
  propertyPanelOpen: true,
  minimapVisible: true,
  palettePanelOpen: true,
  lastSavedDefinition: null,
  lastSavedMeta: null,
  validationErrors: [],
  isLoading: false,
  isSaving: false,
  undoStack: [],
  redoStack: [],
  clipboard: null,
};

export const useWorkflowStore = create<WorkflowStoreState & WorkflowStoreActions>((set, get) => ({
  ...initialState,

  loadWorkflow: (workflow) => {
    const def = workflow.definition;
    set({
      workflowId: workflow.id,
      workflowName: workflow.name,
      workflowDescription: workflow.description || '',
      isActive: workflow.is_active,
      triggerType: workflow.trigger_type,
      triggerConfig: workflow.trigger_config,
      tags: workflow.tags,
      currentVersion: workflow.current_version,
      nodes: def.nodes,
      edges: def.edges,
      lastSavedDefinition: def,
      lastSavedMeta: {
        name: workflow.name,
        description: workflow.description || '',
        triggerType: workflow.trigger_type,
        triggerConfig: JSON.stringify(workflow.trigger_config),
        tags: JSON.stringify(workflow.tags),
      },
      selectedNodeId: null,
      validationErrors: [],
      activeSubWorkflowId: null,
      mainWorkflowSnapshot: null,
      undoStack: [],
      redoStack: [],
    });
  },

  clearWorkflow: () => set(initialState),

  setWorkflowName: (name) => set({ workflowName: name }),
  setWorkflowDescription: (desc) => set({ workflowDescription: desc }),
  setTriggerType: (type) => set({ triggerType: type }),
  setTriggerConfig: (config) => set({ triggerConfig: config }),
  setTags: (tags) => set({ tags }),

  // ── History helpers ─────────────────────────────────────────────────
  pushHistory: () =>
    set((s) => ({
      undoStack: [
        ...s.undoStack.slice(-(MAX_HISTORY - 1)),
        { nodes: structuredClone(s.nodes), edges: structuredClone(s.edges) },
      ],
      redoStack: [], // clear redo on new change
    })),

  undo: () =>
    set((s) => {
      if (s.undoStack.length === 0) return s;
      const prev = s.undoStack[s.undoStack.length - 1]!;
      return {
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [
          ...s.redoStack,
          { nodes: structuredClone(s.nodes), edges: structuredClone(s.edges) },
        ],
        nodes: prev.nodes,
        edges: prev.edges,
        selectedNodeId: null,
      };
    }),

  redo: () =>
    set((s) => {
      if (s.redoStack.length === 0) return s;
      const next = s.redoStack[s.redoStack.length - 1]!;
      return {
        redoStack: s.redoStack.slice(0, -1),
        undoStack: [
          ...s.undoStack,
          { nodes: structuredClone(s.nodes), edges: structuredClone(s.edges) },
        ],
        nodes: next.nodes,
        edges: next.edges,
        selectedNodeId: null,
      };
    }),

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  // ── Copy/Paste ──────────────────────────────────────────────────────
  copySelectedNodes: () => {
    const s = get();
    if (!s.selectedNodeId) return;
    const node = s.nodes.find((n) => n.id === s.selectedNodeId);
    if (!node || node.type === 'start') return; // don't copy start node
    // Collect the selected node + edges that connect between selected nodes
    // For single node selection, just copy the node
    const copiedNodes = [structuredClone(node)];
    set({ clipboard: { nodes: copiedNodes, edges: [] } });
  },

  pasteNodes: () => {
    const s = get();
    if (!s.clipboard || s.clipboard.nodes.length === 0) return;

    // Push history before paste
    get().pushHistory();

    const offset = { x: 50, y: 50 };
    const idMap = new Map<string, string>();
    const newNodes: WorkflowNode[] = s.clipboard.nodes.map((n) => {
      const newId = `${n.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      idMap.set(n.id, newId);
      return {
        ...structuredClone(n),
        id: newId,
        position: { x: n.position.x + offset.x, y: n.position.y + offset.y },
        data: { ...structuredClone(n.data), label: `${n.data.label} (copy)` },
      };
    });

    const newEdges: WorkflowEdge[] = s.clipboard.edges
      .filter((e) => idMap.has(e.source) && idMap.has(e.target))
      .map((e) => ({
        ...structuredClone(e),
        id: `e-${idMap.get(e.source)}-${idMap.get(e.target)}-${Date.now()}`,
        source: idMap.get(e.source)!,
        target: idMap.get(e.target)!,
      }));

    set({
      nodes: [...s.nodes, ...newNodes],
      edges: [...s.edges, ...newEdges],
      selectedNodeId: newNodes[0]?.id ?? null,
    });
  },

  // ── Node operations (with history) ──────────────────────────────────
  addNode: (node) => {
    get().pushHistory();
    set((s) => ({ nodes: [...s.nodes, node] }));
  },
  removeNode: (id) => {
    get().pushHistory();
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
    }));
  },
  updateNodeData: (id, data) => {
    get().pushHistory();
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n
      ),
    }));
  },
  updateNodePosition: (id, position) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, position } : n)),
    })),
  setNodes: (nodes) => set({ nodes }),

  // ── Edge operations (with history) ──────────────────────────────────
  addEdge: (edge) => {
    get().pushHistory();
    set((s) => ({ edges: [...s.edges, edge] }));
  },
  removeEdge: (id) => {
    get().pushHistory();
    set((s) => ({ edges: s.edges.filter((e) => e.id !== id) }));
  },
  setEdges: (edges) => set({ edges }),

  enterSubWorkflow: (nodeId, definition) =>
    set((s) => ({
      activeSubWorkflowId: nodeId,
      mainWorkflowSnapshot: { nodes: s.nodes, edges: s.edges },
      nodes: definition.nodes,
      edges: definition.edges,
      selectedNodeId: null,
      undoStack: [],
      redoStack: [],
    })),

  exitSubWorkflow: () =>
    set((s) => {
      if (!s.mainWorkflowSnapshot || !s.activeSubWorkflowId) return s;
      // Save edited sub-workflow back into the parent node's inline_definition
      const editedDef: WorkflowDefinition = {
        schema_version: WORKFLOW_SCHEMA_VERSION,
        nodes: s.nodes,
        edges: s.edges,
      };
      const updatedParentNodes = s.mainWorkflowSnapshot.nodes.map((n) =>
        n.id === s.activeSubWorkflowId
          ? { ...n, data: { ...n.data, config: { ...n.data.config, inline_definition: editedDef } } }
          : n
      );
      return {
        activeSubWorkflowId: null,
        nodes: updatedParentNodes,
        edges: s.mainWorkflowSnapshot.edges,
        mainWorkflowSnapshot: null,
        selectedNodeId: null,
        undoStack: [],
        redoStack: [],
      };
    }),

  setSelectedNodeId: (id) =>
    set({ selectedNodeId: id, propertyPanelOpen: id !== null }),
  setPropertyPanelOpen: (open) => set({ propertyPanelOpen: open }),
  setMinimapVisible: (visible) => set({ minimapVisible: visible }),
  setPalettePanelOpen: (open) => set({ palettePanelOpen: open }),

  markSaved: () =>
    set((s) => ({
      lastSavedDefinition: {
        schema_version: WORKFLOW_SCHEMA_VERSION,
        nodes: s.nodes,
        edges: s.edges,
      },
      lastSavedMeta: {
        name: s.workflowName,
        description: s.workflowDescription,
        triggerType: s.triggerType,
        triggerConfig: JSON.stringify(s.triggerConfig),
        tags: JSON.stringify(s.tags),
      },
    })),

  hasUnsavedChanges: () => {
    const s = get();
    if (!s.lastSavedDefinition) return s.nodes.length > 0;
    const defChanged =
      JSON.stringify(s.nodes) !== JSON.stringify(s.lastSavedDefinition.nodes) ||
      JSON.stringify(s.edges) !== JSON.stringify(s.lastSavedDefinition.edges);
    if (defChanged) return true;
    if (!s.lastSavedMeta) return false;
    return (
      s.workflowName !== s.lastSavedMeta.name ||
      s.workflowDescription !== s.lastSavedMeta.description ||
      s.triggerType !== s.lastSavedMeta.triggerType ||
      JSON.stringify(s.triggerConfig) !== s.lastSavedMeta.triggerConfig ||
      JSON.stringify(s.tags) !== s.lastSavedMeta.tags
    );
  },

  setValidationErrors: (errors) => set({ validationErrors: errors }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setIsSaving: (saving) => set({ isSaving: saving }),

  getDefinition: () => {
    const s = get();
    return {
      schema_version: WORKFLOW_SCHEMA_VERSION,
      nodes: s.nodes,
      edges: s.edges,
    };
  },
}));

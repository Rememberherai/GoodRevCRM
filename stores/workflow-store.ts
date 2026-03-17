import { create } from 'zustand';
import type {
  WorkflowNode,
  WorkflowEdge,
  WorkflowDefinition,
  WorkflowValidationError,
} from '@/types/workflow';
import { WORKFLOW_SCHEMA_VERSION } from '@/types/workflow';

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

  // Validation
  validationErrors: WorkflowValidationError[];

  // Loading
  isLoading: boolean;
  isSaving: boolean;
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
  validationErrors: [],
  isLoading: false,
  isSaving: false,
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
      selectedNodeId: null,
      validationErrors: [],
      activeSubWorkflowId: null,
      mainWorkflowSnapshot: null,
    });
  },

  clearWorkflow: () => set(initialState),

  setWorkflowName: (name) => set({ workflowName: name }),
  setWorkflowDescription: (desc) => set({ workflowDescription: desc }),
  setTriggerType: (type) => set({ triggerType: type }),
  setTriggerConfig: (config) => set({ triggerConfig: config }),
  setTags: (tags) => set({ tags }),

  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),
  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
    })),
  updateNodeData: (id, data) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n
      ),
    })),
  updateNodePosition: (id, position) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, position } : n)),
    })),
  setNodes: (nodes) => set({ nodes }),

  addEdge: (edge) => set((s) => ({ edges: [...s.edges, edge] })),
  removeEdge: (id) => set((s) => ({ edges: s.edges.filter((e) => e.id !== id) })),
  setEdges: (edges) => set({ edges }),

  enterSubWorkflow: (nodeId, definition) =>
    set((s) => ({
      activeSubWorkflowId: nodeId,
      mainWorkflowSnapshot: { nodes: s.nodes, edges: s.edges },
      nodes: definition.nodes,
      edges: definition.edges,
      selectedNodeId: null,
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
    })),

  hasUnsavedChanges: () => {
    const s = get();
    if (!s.lastSavedDefinition) return s.nodes.length > 0;
    return (
      JSON.stringify(s.nodes) !== JSON.stringify(s.lastSavedDefinition.nodes) ||
      JSON.stringify(s.edges) !== JSON.stringify(s.lastSavedDefinition.edges)
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

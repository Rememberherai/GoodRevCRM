'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type NodeChange,
  type EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useWorkflowStore } from '@/stores/workflow-store';
import { WorkflowToolbar } from './workflow-toolbar';
import { WorkflowNodePalette } from './workflow-node-palette';
import { WorkflowPropertyPanel } from './workflow-property-panel';
import { NODE_COLORS, NODE_PALETTE, NODE_PALETTE_CATEGORIES } from '@/types/workflow';
import type { WorkflowNode, WorkflowEdge, WorkflowNodeType, NodePaletteCategory } from '@/types/workflow';

// Import custom node components
import { StartNode } from './nodes/start-node';
import { EndNode } from './nodes/end-node';
import { ActionNode } from './nodes/action-node';
import { AiAgentNode } from './nodes/ai-agent-node';
import { ConditionNode } from './nodes/condition-node';
import { SwitchNode } from './nodes/switch-node';
import { DelayNode } from './nodes/delay-node';
import { LoopNode } from './nodes/loop-node';
import { SubWorkflowNode } from './nodes/sub-workflow-node';
import { McpToolNode } from './nodes/mcp-tool-node';
import { ZapierNode } from './nodes/zapier-node';
import { WebhookNode } from './nodes/webhook-node';
import { DeletableEdge } from './nodes/deletable-edge';

const nodeTypes = {
  start: StartNode,
  end: EndNode,
  action: ActionNode,
  ai_agent: AiAgentNode,
  condition: ConditionNode,
  switch: SwitchNode,
  delay: DelayNode,
  loop: LoopNode,
  sub_workflow: SubWorkflowNode,
  mcp_tool: McpToolNode,
  zapier: ZapierNode,
  webhook: WebhookNode,
};

const edgeTypes = {
  deletable: DeletableEdge,
};

interface WorkflowEditorProps {
  projectSlug: string;
}

interface ContextMenuState {
  x: number;
  y: number;
  flowX: number;
  flowY: number;
}

function WorkflowEditorInner({ projectSlug }: WorkflowEditorProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const hasFitView = useRef(false);

  const {
    nodes,
    edges,
    addNode,
    setSelectedNodeId,
    selectedNodeId,
    propertyPanelOpen,
    minimapVisible,
    palettePanelOpen,
    activeSubWorkflowId,
  } = useWorkflowStore();

  // Fit view when nodes first load
  useEffect(() => {
    if (nodes.length > 0 && !hasFitView.current) {
      // Small delay to let ReactFlow measure node dimensions
      const timer = setTimeout(() => {
        fitView({ padding: 0.2 });
        hasFitView.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [nodes.length, fitView]);

  // DEBUG: Log nodes to help diagnose rendering issues (only on count change)
  useEffect(() => {
    console.log('[WorkflowEditor] nodes count:', nodes.length);
    if (nodes.length > 0) {
      console.log('[WorkflowEditor] nodes:', JSON.stringify(nodes.map(n => ({ id: n.id, type: n.type, position: n.position })), null, 2));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length]);

  // Convert our nodes/edges to ReactFlow format
  const rfNodes: Node[] = nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data,
    selected: n.id === selectedNodeId,
  }));

  const rfEdges: Edge[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    label: e.label,
    animated: e.animated,
    type: 'deletable',
  }));

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Filter out dimension changes — they come from React Flow measuring nodes
      // and cause infinite re-render loops when we write them back to the store
      const meaningful = changes.filter((c) => c.type !== 'dimensions');
      if (meaningful.length === 0) return;

      const store = useWorkflowStore.getState();
      const currentRfNodes: Node[] = store.nodes.map((n) => ({
        id: n.id, type: n.type, position: n.position, data: n.data,
        selected: n.id === store.selectedNodeId,
      }));
      const updated = applyNodeChanges(meaningful, currentRfNodes) as Node[];
      store.setNodes(
        updated.map((n) => ({
          id: n.id,
          type: n.type as WorkflowNodeType,
          position: n.position,
          data: n.data as WorkflowNode['data'],
        }))
      );
    },
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const store = useWorkflowStore.getState();
      const currentRfEdges: Edge[] = store.edges.map((e) => ({
        id: e.id, source: e.source, target: e.target,
        sourceHandle: e.sourceHandle, targetHandle: e.targetHandle,
        label: e.label, animated: e.animated, type: 'deletable',
      }));
      const updated = applyEdgeChanges(changes, currentRfEdges) as Edge[];
      store.setEdges(
        updated.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle || undefined,
          targetHandle: e.targetHandle || undefined,
          label: typeof e.label === 'string' ? e.label : undefined,
          animated: e.animated,
        }))
      );
    },
    []
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      // Prevent self-loops and duplicate edges
      if (connection.source === connection.target) return;
      const store = useWorkflowStore.getState();
      const duplicate = store.edges.some(
        (e) => e.source === connection.source && e.target === connection.target && e.sourceHandle === (connection.sourceHandle || undefined)
      );
      if (duplicate) return;

      const newEdge: WorkflowEdge = {
        id: `e-${connection.source}-${connection.target}-${Date.now()}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle || undefined,
      };
      store.addEdge(newEdge);
    },
    []
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setContextMenu(null);
  }, [setSelectedNodeId]);

  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        flowX: flowPos.x,
        flowY: flowPos.y,
      });
    },
    [screenToFlowPosition]
  );

  const addNodeFromContextMenu = useCallback(
    (type: WorkflowNodeType) => {
      console.log('[ContextMenu] addNode called, type:', type, 'contextMenu:', contextMenu);
      if (!contextMenu) {
        console.warn('[ContextMenu] contextMenu is null, skipping add');
        return;
      }
      const newNode: WorkflowNode = {
        id: `${type}-${Date.now()}`,
        type,
        position: { x: contextMenu.flowX, y: contextMenu.flowY },
        data: {
          label: type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' '),
          config: {},
        },
      };
      console.log('[ContextMenu] adding node:', JSON.stringify(newNode));
      addNode(newNode);
      setSelectedNodeId(newNode.id);
      setContextMenu(null);
    },
    [contextMenu, addNode, setSelectedNodeId]
  );

  // Handle drag-and-drop from palette
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/workflow-node-type') as WorkflowNodeType;
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: WorkflowNode = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: {
          label: type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' '),
          config: {},
        },
      };

      addNode(newNode);
    },
    [screenToFlowPosition, addNode]
  );

  const onInit = useCallback(() => {
    // Fit view once ReactFlow is ready and has measured nodes
    setTimeout(() => fitView({ padding: 0.2 }), 50);
  }, [fitView]);

  // Close context menu on scroll or click outside (but not on menu items)
  const contextMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!contextMenu) return;
    const closeOnScroll = () => setContextMenu(null);
    const closeOnClick = (e: MouseEvent) => {
      // Don't close if clicking inside the context menu itself
      if (contextMenuRef.current?.contains(e.target as HTMLElement)) return;
      setContextMenu(null);
    };
    window.addEventListener('scroll', closeOnScroll, true);
    window.addEventListener('mousedown', closeOnClick);
    return () => {
      window.removeEventListener('scroll', closeOnScroll, true);
      window.removeEventListener('mousedown', closeOnClick);
    };
  }, [contextMenu]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Cmd+S: Save
      if (isMod && e.key === 's') {
        e.preventDefault();
        document.querySelector<HTMLButtonElement>('[data-save-btn]')?.click();
      }

      // Cmd+Z: Undo / Cmd+Shift+Z: Redo
      if (isMod && e.key === 'z' && !isInput) {
        e.preventDefault();
        const store = useWorkflowStore.getState();
        if (e.shiftKey) {
          store.redo();
        } else {
          store.undo();
        }
      }

      // Cmd+C: Copy selected node
      if (isMod && e.key === 'c' && !isInput) {
        const store = useWorkflowStore.getState();
        if (store.selectedNodeId) {
          e.preventDefault();
          store.copySelectedNodes();
        }
      }

      // Cmd+V: Paste nodes
      if (isMod && e.key === 'v' && !isInput) {
        const store = useWorkflowStore.getState();
        if (store.clipboard) {
          e.preventDefault();
          store.pasteNodes();
        }
      }

      // Delete/Backspace: Remove selected node
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
        if (isInput) return;
        e.preventDefault();
        const store = useWorkflowStore.getState();
        const node = store.nodes.find((n) => n.id === selectedNodeId);
        if (node && node.type !== 'start') {
          store.removeNode(selectedNodeId);
          store.setSelectedNodeId(null);
        }
      }

      // Escape: Deselect
      if (e.key === 'Escape') {
        setSelectedNodeId(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, setSelectedNodeId]);

  return (
    <div className="flex flex-col -m-6" style={{ width: 'calc(100% + 3rem)', height: 'calc(100vh - 3.5rem)' }}>
      <WorkflowToolbar projectSlug={projectSlug} />

      {activeSubWorkflowId && (
        <div className="bg-indigo-50 dark:bg-indigo-950 border-b px-4 py-2 text-sm flex items-center gap-2">
          <span className="text-indigo-600 dark:text-indigo-400 font-medium">
            Editing Sub-Workflow
          </span>
          <button
            onClick={() => useWorkflowStore.getState().exitSubWorkflow()}
            className="text-indigo-600 hover:text-indigo-800 underline text-xs"
          >
            Back to main workflow
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Node Palette */}
        {palettePanelOpen && (
          <div className="w-56 border-r overflow-y-auto bg-background">
            <WorkflowNodePalette />
          </div>
        )}

        {/* Center: ReactFlow Canvas */}
        <div className="flex-1 h-full" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={onInit}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onPaneContextMenu={onPaneContextMenu}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={{ type: 'deletable', animated: false }}
            fitView
            snapToGrid
            snapGrid={[16, 16]}
            deleteKeyCode={null}
            className="bg-muted/30"
          >
            <Controls />
            {minimapVisible && (
              <MiniMap
                nodeColor={(n) => NODE_COLORS[n.type as WorkflowNodeType] || '#94a3b8'}
                maskColor="rgba(0,0,0,0.1)"
                className="!bottom-4 !right-4"
              />
            )}
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          </ReactFlow>

          {/* Right-click context menu */}
          {contextMenu && (
            <div
              ref={contextMenuRef}
              className="fixed z-50 min-w-[180px] bg-popover border rounded-lg shadow-lg py-1 text-sm"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              {(Object.keys(NODE_PALETTE_CATEGORIES) as NodePaletteCategory[]).map((cat) => (
                <div key={cat}>
                  <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {NODE_PALETTE_CATEGORIES[cat]}
                  </div>
                  {NODE_PALETTE.filter((n) => n.category === cat).map((item) => (
                    <button
                      key={item.type}
                      className="w-full text-left px-3 py-1.5 hover:bg-accent transition-colors flex items-center gap-2"
                      onClick={() => addNodeFromContextMenu(item.type)}
                    >
                      <span className="text-xs">{item.label}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Property Panel */}
        {propertyPanelOpen && selectedNodeId && (
          <div className="w-80 border-l overflow-y-auto bg-background">
            <WorkflowPropertyPanel />
          </div>
        )}
      </div>
    </div>
  );
}

export function WorkflowEditor({ projectSlug }: WorkflowEditorProps) {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner projectSlug={projectSlug} />
    </ReactFlowProvider>
  );
}

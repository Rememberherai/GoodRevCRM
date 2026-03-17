'use client';

import { useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type {
  WorkflowDefinition,
  WorkflowStepExecution,
  StepExecutionStatus,
} from '@/types/workflow';

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

const STEP_STATUS_COLORS: Record<StepExecutionStatus, string> = {
  pending: '#94a3b8',   // slate-400
  running: '#3b82f6',   // blue-500
  completed: '#10b981', // emerald-500
  failed: '#ef4444',    // red-500
  skipped: '#d1d5db',   // gray-300
  waiting: '#f59e0b',   // amber-500
};

interface WorkflowExecutionViewerProps {
  definition: WorkflowDefinition;
  steps: WorkflowStepExecution[];
  onNodeClick?: (nodeId: string) => void;
}

function ViewerInner({ definition, steps, onNodeClick }: WorkflowExecutionViewerProps) {
  // Build a map of node_id → latest step status
  const stepStatusMap = useMemo(() => {
    const map = new Map<string, StepExecutionStatus>();
    // Steps may have duplicates (loop iterations, retries) — use latest
    for (const step of steps) {
      map.set(step.node_id, step.status);
    }
    return map;
  }, [steps]);

  const rfNodes: Node[] = useMemo(
    () =>
      definition.nodes.map((n) => {
        const stepStatus = stepStatusMap.get(n.id);
        const borderColor = stepStatus ? STEP_STATUS_COLORS[stepStatus] : '#e2e8f0';
        return {
          id: n.id,
          type: n.type,
          position: n.position,
          data: {
            ...n.data,
            // Pass execution status to node for styling
            _executionStatus: stepStatus,
          },
          style: {
            border: `3px solid ${borderColor}`,
            borderRadius: '8px',
            boxShadow: stepStatus === 'running' ? `0 0 12px ${borderColor}` : undefined,
          },
        };
      }),
    [definition.nodes, stepStatusMap]
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      definition.edges.map((e) => {
        const sourceStatus = stepStatusMap.get(e.source);
        const isTraversed = sourceStatus === 'completed';
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          label: e.label,
          animated: sourceStatus === 'running',
          style: {
            stroke: isTraversed ? '#10b981' : '#94a3b8',
            strokeWidth: isTraversed ? 2 : 1,
          },
        };
      }),
    [definition.edges, stepStatusMap]
  );

  return (
    <div className="h-[500px] border rounded-lg overflow-hidden">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onNodeClick?.(node.id)}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        className="bg-muted/20"
      >
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => {
            const status = stepStatusMap.get(n.id);
            return status ? STEP_STATUS_COLORS[status] : '#94a3b8';
          }}
          maskColor="rgba(0,0,0,0.08)"
        />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      </ReactFlow>

      {/* Legend */}
      <div className="flex items-center gap-4 px-3 py-2 border-t bg-background text-xs">
        {Object.entries(STEP_STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="capitalize">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WorkflowExecutionViewer(props: WorkflowExecutionViewerProps) {
  return (
    <ReactFlowProvider>
      <ViewerInner {...props} />
    </ReactFlowProvider>
  );
}

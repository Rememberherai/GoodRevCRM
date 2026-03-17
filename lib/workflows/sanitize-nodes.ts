/**
 * Sanitizes workflow nodes/edges from AI-generated definitions.
 * Ensures valid node types, positions, and required fields.
 */

import { WORKFLOW_SCHEMA_VERSION } from '@/types/workflow';
import type { WorkflowNodeType } from '@/types/workflow';

const VALID_NODE_TYPES = new Set<WorkflowNodeType>([
  'start', 'end', 'action', 'ai_agent', 'condition', 'switch',
  'delay', 'loop', 'sub_workflow', 'mcp_tool', 'webhook', 'zapier',
]);

/** Common AI mistakes → correct type mappings */
const TYPE_ALIASES: Record<string, WorkflowNodeType> = {
  trigger: 'start',
  begin: 'start',
  entry: 'start',
  stop: 'end',
  finish: 'end',
  exit: 'end',
  terminal: 'end',
  if: 'condition',
  ifelse: 'condition',
  if_else: 'condition',
  branch: 'condition',
  wait: 'delay',
  timer: 'delay',
  sleep: 'delay',
  http: 'webhook',
  api: 'webhook',
  ai: 'ai_agent',
  agent: 'ai_agent',
  llm: 'ai_agent',
  mcp: 'mcp_tool',
  tool: 'mcp_tool',
  subflow: 'sub_workflow',
  sub_flow: 'sub_workflow',
  iterate: 'loop',
  foreach: 'loop',
  for_each: 'loop',
};

interface RawNode {
  id?: string;
  type?: string;
  position?: { x?: number; y?: number };
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

interface RawEdge {
  id?: string;
  source?: string;
  target?: string;
  sourceHandle?: string;
  label?: string;
  [key: string]: unknown;
}

interface SanitizedDefinition {
  schema_version: string;
  nodes: Array<{
    id: string;
    type: WorkflowNodeType;
    position: { x: number; y: number };
    data: { label: string; config: Record<string, unknown>; description?: string };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    label?: string;
  }>;
}

const DEFAULT_DEFINITION: SanitizedDefinition = {
  schema_version: WORKFLOW_SCHEMA_VERSION,
  nodes: [
    { id: 'start-1', type: 'start', position: { x: 250, y: 50 }, data: { label: 'Start', config: {} } },
    { id: 'end-1', type: 'end', position: { x: 250, y: 300 }, data: { label: 'End', config: {} } },
  ],
  edges: [{ id: 'e-start-end', source: 'start-1', target: 'end-1' }],
};

/**
 * Sanitizes an AI-generated workflow definition to ensure all nodes have
 * valid types, positions, and required data fields. Falls back to a
 * default definition if the input is empty or completely invalid.
 */
export function sanitizeWorkflowDefinition(
  rawNodes?: unknown[],
  rawEdges?: unknown[],
): SanitizedDefinition {
  if (!rawNodes || rawNodes.length === 0) {
    return DEFAULT_DEFINITION;
  }

  const Y_SPACING = 150;
  const X_CENTER = 250;

  // Sanitize nodes
  const nodes: SanitizedDefinition['nodes'] = [];
  const idMap = new Map<string, string>(); // old id → new id

  for (let i = 0; i < rawNodes.length; i++) {
    const raw = rawNodes[i] as RawNode;
    if (!raw || typeof raw !== 'object') continue;

    // Resolve type
    const rawType = (raw.type || 'action').toLowerCase().trim();
    const resolvedType: WorkflowNodeType =
      VALID_NODE_TYPES.has(rawType as WorkflowNodeType)
        ? (rawType as WorkflowNodeType)
        : TYPE_ALIASES[rawType] ?? 'action';

    // Resolve ID
    const rawId = raw.id ? String(raw.id) : `${resolvedType}-${i + 1}`;
    const newId = rawId.match(/^[a-zA-Z0-9_-]+$/) ? rawId : `${resolvedType}-${i + 1}`;
    idMap.set(raw.id ? String(raw.id) : newId, newId);

    // Resolve position — auto-layout vertically if missing
    const pos = raw.position;
    const x = (pos && typeof pos.x === 'number') ? pos.x : X_CENTER;
    const y = (pos && typeof pos.y === 'number') ? pos.y : 50 + i * Y_SPACING;

    // Resolve data
    const rawData = (raw.data && typeof raw.data === 'object') ? raw.data : {};
    const label = (rawData.label as string) ||
      resolvedType.charAt(0).toUpperCase() + resolvedType.slice(1).replace(/_/g, ' ');
    const config = (rawData.config && typeof rawData.config === 'object')
      ? rawData.config as Record<string, unknown>
      : {};

    // Pull action-specific config from data root (AI often puts it there)
    if (resolvedType === 'action' && !config.action_type && rawData.action_type) {
      config.action_type = rawData.action_type;
    }
    if (rawData.template_id) config.template_id = rawData.template_id;
    if (rawData.task_title) config.task_title = rawData.task_title;
    if (rawData.due_date_offset) config.due_date_offset = rawData.due_date_offset;

    nodes.push({
      id: newId,
      type: resolvedType,
      position: { x, y },
      data: {
        label,
        config,
        ...(rawData.description ? { description: String(rawData.description) } : {}),
      },
    });
  }

  // Ensure there's a start node
  const hasStart = nodes.some((n) => n.type === 'start');
  if (!hasStart) {
    // Shift all nodes down and add start at top
    for (const n of nodes) n.position.y += Y_SPACING;
    nodes.unshift({
      id: 'start-1',
      type: 'start',
      position: { x: X_CENTER, y: 50 },
      data: { label: 'Start', config: {} },
    });
    idMap.set('start-1', 'start-1');
  }

  // Ensure there's an end node
  const hasEnd = nodes.some((n) => n.type === 'end');
  if (!hasEnd) {
    const maxY = Math.max(...nodes.map((n) => n.position.y));
    nodes.push({
      id: 'end-1',
      type: 'end',
      position: { x: X_CENTER, y: maxY + Y_SPACING },
      data: { label: 'End', config: {} },
    });
    idMap.set('end-1', 'end-1');
  }

  // Sanitize edges
  const edges: SanitizedDefinition['edges'] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));

  if (rawEdges && rawEdges.length > 0) {
    for (const rawEdge of rawEdges) {
      const re = rawEdge as RawEdge;
      if (!re || typeof re !== 'object') continue;

      const source = idMap.get(String(re.source ?? '')) ?? String(re.source ?? '');
      const target = idMap.get(String(re.target ?? '')) ?? String(re.target ?? '');

      if (!nodeIds.has(source) || !nodeIds.has(target)) continue;
      if (source === target) continue;

      edges.push({
        id: re.id ? String(re.id) : `e-${source}-${target}`,
        source,
        target,
        ...(re.sourceHandle ? { sourceHandle: String(re.sourceHandle) } : {}),
        ...(re.label ? { label: String(re.label) } : {}),
      });
    }
  }

  // If no edges provided, auto-connect nodes sequentially
  if (edges.length === 0 && nodes.length > 1) {
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        id: `e-${nodes[i]!.id}-${nodes[i + 1]!.id}`,
        source: nodes[i]!.id,
        target: nodes[i + 1]!.id,
      });
    }
  }

  return {
    schema_version: WORKFLOW_SCHEMA_VERSION,
    nodes,
    edges,
  };
}

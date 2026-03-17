// Comprehensive workflow graph validation
// Modeled after cc-wf-studio's validate-workflow.ts

import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeType,
  WorkflowValidationError,
} from '@/types/workflow';
import { WORKFLOW_CONSTRAINTS } from '@/types/workflow';

export function validateWorkflow(
  definition: WorkflowDefinition,
  options: { isSubWorkflow?: boolean } = {}
): WorkflowValidationError[] {
  const errors: WorkflowValidationError[] = [];
  const { nodes, edges } = definition;
  const maxNodes = options.isSubWorkflow
    ? WORKFLOW_CONSTRAINTS.MAX_SUB_WORKFLOW_NODES
    : WORKFLOW_CONSTRAINTS.MAX_NODES;

  // ── Structural Validation ────────────────────────────────────────────

  // Max nodes
  if (nodes.length > maxNodes) {
    errors.push({
      code: 'MAX_NODES_EXCEEDED',
      message: `Workflow exceeds maximum of ${maxNodes} nodes (has ${nodes.length})`,
      severity: 'error',
    });
  }

  // Unique node IDs
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (nodeIds.has(node.id)) {
      errors.push({
        code: 'DUPLICATE_NODE_ID',
        message: `Duplicate node ID: "${node.id}"`,
        nodeId: node.id,
        severity: 'error',
      });
    }
    nodeIds.add(node.id);
  }

  // Unique edge IDs
  const edgeIds = new Set<string>();
  for (const edge of edges) {
    if (edgeIds.has(edge.id)) {
      errors.push({
        code: 'DUPLICATE_EDGE_ID',
        message: `Duplicate edge ID: "${edge.id}"`,
        edgeId: edge.id,
        severity: 'error',
      });
    }
    edgeIds.add(edge.id);
  }

  // ── Start/End Node Validation ────────────────────────────────────────

  const startNodes = nodes.filter((n) => n.type === 'start');
  const endNodes = nodes.filter((n) => n.type === 'end');

  if (startNodes.length === 0) {
    errors.push({
      code: 'NO_START_NODE',
      message: 'Workflow must have exactly 1 Start node',
      severity: 'error',
    });
  } else if (startNodes.length > WORKFLOW_CONSTRAINTS.REQUIRED_START_NODES) {
    errors.push({
      code: 'MULTIPLE_START_NODES',
      message: `Workflow must have exactly 1 Start node (has ${startNodes.length})`,
      severity: 'error',
    });
  }

  if (endNodes.length < WORKFLOW_CONSTRAINTS.MIN_END_NODES) {
    errors.push({
      code: 'NO_END_NODE',
      message: 'Workflow must have at least 1 End node',
      severity: 'error',
    });
  }

  // ── Edge Validation ──────────────────────────────────────────────────

  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push({
        code: 'ORPHANED_EDGE_SOURCE',
        message: `Edge "${edge.id}" references non-existent source node "${edge.source}"`,
        edgeId: edge.id,
        severity: 'error',
      });
    }
    if (!nodeIds.has(edge.target)) {
      errors.push({
        code: 'ORPHANED_EDGE_TARGET',
        message: `Edge "${edge.id}" references non-existent target node "${edge.target}"`,
        edgeId: edge.id,
        severity: 'error',
      });
    }
    // Self-loops
    if (edge.source === edge.target) {
      errors.push({
        code: 'SELF_LOOP',
        message: `Edge "${edge.id}" creates a self-loop on node "${edge.source}"`,
        edgeId: edge.id,
        nodeId: edge.source,
        severity: 'error',
      });
    }
  }

  // No incoming edges to start node
  for (const startNode of startNodes) {
    const incomingToStart = edges.filter((e) => e.target === startNode.id);
    if (incomingToStart.length > 0) {
      errors.push({
        code: 'START_HAS_INCOMING',
        message: 'Start node must not have incoming edges',
        nodeId: startNode.id,
        severity: 'error',
      });
    }
  }

  // No outgoing edges from end nodes
  for (const endNode of endNodes) {
    const outgoingFromEnd = edges.filter((e) => e.source === endNode.id);
    if (outgoingFromEnd.length > 0) {
      errors.push({
        code: 'END_HAS_OUTGOING',
        message: `End node "${endNode.id}" must not have outgoing edges`,
        nodeId: endNode.id,
        severity: 'error',
      });
    }
  }

  // ── Connectivity: All nodes reachable from start ─────────────────────

  if (startNodes.length === 1) {
    const reachable = new Set<string>();
    const adjacency = buildAdjacencyList(nodes, edges);
    bfs(startNodes[0]!.id, adjacency, reachable);

    for (const node of nodes) {
      if (!reachable.has(node.id)) {
        errors.push({
          code: 'UNREACHABLE_NODE',
          message: `Node "${node.data.label}" (${node.id}) is not reachable from Start`,
          nodeId: node.id,
          severity: 'warning',
        });
      }
    }
  }

  // ── Cycle Detection (DAG check, loop nodes exempt) ───────────────────

  const loopNodeIds = new Set(nodes.filter((n) => n.type === 'loop').map((n) => n.id));
  const cycleErrors = detectCycles(nodes, edges, loopNodeIds);
  errors.push(...cycleErrors);

  // ── Node-Type-Specific Validation ────────────────────────────────────

  for (const node of nodes) {
    const outgoing = edges.filter((e) => e.source === node.id);
    const incoming = edges.filter((e) => e.target === node.id);

    switch (node.type) {
      case 'start': {
        if (outgoing.length === 0) {
          errors.push({
            code: 'START_NO_OUTGOING',
            message: 'Start node must have at least 1 outgoing connection',
            nodeId: node.id,
            severity: 'error',
          });
        }
        break;
      }

      case 'end': {
        if (incoming.length === 0) {
          errors.push({
            code: 'END_NO_INCOMING',
            message: `End node "${node.data.label}" has no incoming connections`,
            nodeId: node.id,
            severity: 'warning',
          });
        }
        break;
      }

      case 'condition': {
        // Must have exactly 2 outgoing: one with sourceHandle 'true', one 'false'
        const trueEdges = outgoing.filter((e) => e.sourceHandle === 'true');
        const falseEdges = outgoing.filter((e) => e.sourceHandle === 'false');
        if (trueEdges.length === 0) {
          errors.push({
            code: 'CONDITION_MISSING_TRUE',
            message: `Condition "${node.data.label}" missing "true" branch`,
            nodeId: node.id,
            severity: 'error',
          });
        }
        if (falseEdges.length === 0) {
          errors.push({
            code: 'CONDITION_MISSING_FALSE',
            message: `Condition "${node.data.label}" missing "false" branch`,
            nodeId: node.id,
            severity: 'error',
          });
        }
        // Validate config has field and operator
        if (!node.data.config.field) {
          errors.push({
            code: 'CONDITION_NO_FIELD',
            message: `Condition "${node.data.label}" requires a field to evaluate`,
            nodeId: node.id,
            severity: 'error',
          });
        }
        break;
      }

      case 'switch': {
        const cases = node.data.config.cases as Array<{ value: unknown; label: string }> | undefined;
        if (!cases || cases.length === 0) {
          errors.push({
            code: 'SWITCH_NO_CASES',
            message: `Switch "${node.data.label}" requires at least 1 case`,
            nodeId: node.id,
            severity: 'error',
          });
        }
        // Check that each case has an outgoing edge
        if (cases) {
          for (const c of cases) {
            const caseEdge = outgoing.find((e) => e.sourceHandle === c.label);
            if (!caseEdge) {
              errors.push({
                code: 'SWITCH_MISSING_CASE_EDGE',
                message: `Switch "${node.data.label}" missing connection for case "${c.label}"`,
                nodeId: node.id,
                severity: 'warning',
              });
            }
          }
        }
        // Check default branch
        const defaultLabel = (node.data.config.default_label as string) || 'default';
        const defaultEdge = outgoing.find((e) => e.sourceHandle === defaultLabel);
        if (!defaultEdge) {
          errors.push({
            code: 'SWITCH_MISSING_DEFAULT',
            message: `Switch "${node.data.label}" missing default branch`,
            nodeId: node.id,
            severity: 'warning',
          });
        }
        break;
      }

      case 'action': {
        if (!node.data.config.action_type) {
          errors.push({
            code: 'ACTION_NO_TYPE',
            message: `Action "${node.data.label}" requires an action type`,
            nodeId: node.id,
            severity: 'error',
          });
        }
        break;
      }

      case 'ai_agent': {
        if (!node.data.config.prompt) {
          errors.push({
            code: 'AI_AGENT_NO_PROMPT',
            message: `AI Agent "${node.data.label}" requires a prompt`,
            nodeId: node.id,
            severity: 'error',
          });
        }
        break;
      }

      case 'delay': {
        const delayType = node.data.config.delay_type;
        if (!delayType) {
          errors.push({
            code: 'DELAY_NO_TYPE',
            message: `Delay "${node.data.label}" requires a delay type (duration, until_date, or until_field)`,
            nodeId: node.id,
            severity: 'error',
          });
        }
        break;
      }

      case 'loop': {
        if (!node.data.config.collection_path) {
          errors.push({
            code: 'LOOP_NO_COLLECTION',
            message: `Loop "${node.data.label}" requires a collection path`,
            nodeId: node.id,
            severity: 'error',
          });
        }
        break;
      }

      case 'sub_workflow': {
        const hasRef = !!node.data.config.workflow_id;
        const hasInline = !!(node.data.config.inline_definition as WorkflowDefinition | undefined);
        if (!hasRef && !hasInline) {
          errors.push({
            code: 'SUB_WORKFLOW_NO_TARGET',
            message: `Sub-Workflow "${node.data.label}" requires a workflow reference or inline definition`,
            nodeId: node.id,
            severity: 'error',
          });
        }
        // Validate inline sub-workflow if provided
        if (hasInline) {
          const inlineDef = node.data.config.inline_definition as WorkflowDefinition;
          const subErrors = validateWorkflow(inlineDef, { isSubWorkflow: true });
          for (const err of subErrors) {
            errors.push({
              ...err,
              message: `Sub-Workflow "${node.data.label}": ${err.message}`,
              nodeId: node.id,
            });
          }
          // Sub-workflows cannot contain certain node types (like cc-wf-studio)
          const forbiddenTypes: WorkflowNodeType[] = ['sub_workflow'];
          for (const subNode of inlineDef.nodes) {
            if (forbiddenTypes.includes(subNode.type)) {
              errors.push({
                code: 'SUB_WORKFLOW_FORBIDDEN_NODE',
                message: `Sub-Workflow "${node.data.label}" cannot contain ${subNode.type} nodes`,
                nodeId: node.id,
                severity: 'error',
              });
            }
          }
        }
        break;
      }

      case 'mcp_tool': {
        const mode = node.data.config.mode;
        if (!mode) {
          errors.push({
            code: 'MCP_NO_MODE',
            message: `MCP Tool "${node.data.label}" requires a mode (manual, ai_params, or ai_selection)`,
            nodeId: node.id,
            severity: 'error',
          });
        }
        if (mode === 'manual' && !node.data.config.tool_name) {
          errors.push({
            code: 'MCP_MANUAL_NO_TOOL',
            message: `MCP Tool "${node.data.label}" in manual mode requires a tool name`,
            nodeId: node.id,
            severity: 'error',
          });
        }
        if ((mode === 'ai_params' || mode === 'ai_selection') && !node.data.config.task_description) {
          errors.push({
            code: 'MCP_AI_NO_PROMPT',
            message: `MCP Tool "${node.data.label}" in ${mode} mode requires a natural language prompt`,
            nodeId: node.id,
            severity: 'error',
          });
        }
        break;
      }

      case 'webhook': {
        if (!node.data.config.url) {
          errors.push({
            code: 'WEBHOOK_NO_URL',
            message: `Webhook "${node.data.label}" requires a URL`,
            nodeId: node.id,
            severity: 'error',
          });
        }
        break;
      }

      case 'zapier': {
        if (!node.data.config.connection_id) {
          errors.push({
            code: 'ZAPIER_NO_CONNECTION',
            message: `Zapier "${node.data.label}" requires an API connection`,
            nodeId: node.id,
            severity: 'error',
          });
        }
        if (!node.data.config.action) {
          errors.push({
            code: 'ZAPIER_NO_ACTION',
            message: `Zapier "${node.data.label}" requires an action`,
            nodeId: node.id,
            severity: 'error',
          });
        }
        break;
      }
    }

    // Generic: non-start/end nodes should have at least 1 incoming edge
    if (node.type !== 'start' && incoming.length === 0) {
      errors.push({
        code: 'NODE_NO_INCOMING',
        message: `Node "${node.data.label}" (${node.type}) has no incoming connections`,
        nodeId: node.id,
        severity: 'warning',
      });
    }

    // Generic: non-end nodes should have at least 1 outgoing edge
    if (node.type !== 'end' && outgoing.length === 0) {
      errors.push({
        code: 'NODE_NO_OUTGOING',
        message: `Node "${node.data.label}" (${node.type}) has no outgoing connections`,
        nodeId: node.id,
        severity: 'warning',
      });
    }
  }

  return errors;
}

// ── Helpers ────────────────────────────────────────────────────────────

function buildAdjacencyList(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const node of nodes) {
    adj.set(node.id, []);
  }
  for (const edge of edges) {
    const list = adj.get(edge.source);
    if (list) list.push(edge.target);
  }
  return adj;
}

function bfs(
  startId: string,
  adjacency: Map<string, string[]>,
  visited: Set<string>
): void {
  const queue = [startId];
  visited.add(startId);
  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
}

function detectCycles(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  loopNodeIds: Set<string>
): WorkflowValidationError[] {
  const errors: WorkflowValidationError[] = [];

  // Filter out edges that originate from loop nodes (they're intentional cycles)
  const nonLoopEdges = edges.filter((e) => !loopNodeIds.has(e.source));

  // Build adjacency for non-loop edges
  const adj = new Map<string, string[]>();
  for (const node of nodes) {
    adj.set(node.id, []);
  }
  for (const edge of nonLoopEdges) {
    const list = adj.get(edge.source);
    if (list) list.push(edge.target);
  }

  // DFS-based cycle detection
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const node of nodes) {
    color.set(node.id, WHITE);
  }

  function dfs(nodeId: string): boolean {
    color.set(nodeId, GRAY);
    const neighbors = adj.get(nodeId) || [];
    for (const neighbor of neighbors) {
      const c = color.get(neighbor);
      if (c === GRAY) {
        // Back edge = cycle
        errors.push({
          code: 'CYCLE_DETECTED',
          message: `Cycle detected involving node "${nodeId}" → "${neighbor}"`,
          nodeId: neighbor,
          severity: 'error',
        });
        return true;
      }
      if (c === WHITE && dfs(neighbor)) {
        return true;
      }
    }
    color.set(nodeId, BLACK);
    return false;
  }

  for (const node of nodes) {
    if (color.get(node.id) === WHITE) {
      dfs(node.id);
    }
  }

  return errors;
}

// Quick helper to check if a workflow has only errors (no warnings)
export function hasErrors(errors: WorkflowValidationError[]): boolean {
  return errors.some((e) => e.severity === 'error');
}

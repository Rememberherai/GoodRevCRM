import { createClient } from '@supabase/supabase-js';
import { executeAction } from '@/lib/automations/actions';
import { evaluateConditions } from '@/lib/automations/conditions';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  WorkflowExecutionStatus,
  StepExecutionStatus,
} from '@/types/workflow';
import { WORKFLOW_CONSTRAINTS } from '@/types/workflow';
import type { AutomationAction, AutomationCondition, AutomationEntityType } from '@/types/automation';

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface ExecutionContext {
  executionId: string;
  workflowId: string;
  projectId: string;
  contextData: Record<string, unknown>;
  depth: number;
  stepCount: number;
  insideLoop: boolean;
  hasPendingDelay: boolean;
}

/**
 * Execute a workflow from the start node
 */
export async function executeWorkflow(
  workflowId: string,
  executionId: string,
  projectId: string,
  definition: WorkflowDefinition,
  initialContext: Record<string, unknown> = {},
  depth = 0
): Promise<void> {
  const supabase = createAdminClient();

  if (depth >= WORKFLOW_CONSTRAINTS.MAX_CHAIN_DEPTH) {
    if (depth === 0) await updateExecutionStatus(supabase, executionId, 'failed', 'Max sub-workflow depth exceeded');
    return;
  }

  const ctx: ExecutionContext = {
    executionId,
    workflowId,
    projectId,
    contextData: { ...initialContext },
    depth,
    stepCount: 0,
    insideLoop: false,
    hasPendingDelay: false,
  };

  const { nodes, edges } = definition;
  const startNode = nodes.find((n) => n.type === 'start');

  if (!startNode) {
    if (depth === 0) await updateExecutionStatus(supabase, executionId, 'failed', 'No start node found');
    return;
  }

  try {
    await traverseNode(supabase, startNode, nodes, edges, ctx);

    // Only update execution status for the top-level workflow, not sub-workflows
    if (depth === 0) {
      if (ctx.hasPendingDelay) {
        // A delay node paused execution — mark as paused so the delay processor can resume
        await updateExecutionStatus(supabase, executionId, 'paused');
      } else {
        await updateExecutionStatus(supabase, executionId, 'completed');

        emitAutomationEvent({
          projectId,
          triggerType: 'workflow.completed',
          entityType: 'workflow',
          entityId: workflowId,
          data: { workflow_id: workflowId, execution_id: executionId },
        }).catch(console.error);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (depth === 0) {
      await updateExecutionStatus(supabase, executionId, 'failed', message);

      emitAutomationEvent({
        projectId,
        triggerType: 'workflow.failed',
        entityType: 'workflow',
        entityId: workflowId,
        data: { workflow_id: workflowId, execution_id: executionId, error: message },
      }).catch(console.error);
    } else {
      throw error; // Propagate to parent workflow
    }
  }
}

async function traverseNode(
  supabase: ReturnType<typeof createAdminClient>,
  node: WorkflowNode,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  ctx: ExecutionContext
): Promise<void> {
  ctx.stepCount++;
  if (ctx.stepCount > WORKFLOW_CONSTRAINTS.MAX_EXECUTION_STEPS) {
    throw new Error('Max execution steps exceeded');
  }

  // Check if this node was already executed in this run (prevents re-execution on delay resume)
  // Skip this check inside loops, since loop body nodes execute multiple times
  if (!ctx.insideLoop) {
    const { data: existingStep } = await supabase
      .from('workflow_step_executions')
      .select('id, status')
      .eq('execution_id', ctx.executionId)
      .eq('node_id', node.id)
      .in('status', ['completed', 'running', 'waiting'])
      .limit(1)
      .single();

    if (existingStep) {
      // Already executed — skip and continue to next nodes
      const outEdges = edges.filter((e) => e.source === node.id);
      for (const edge of outEdges) {
        const targetNode = nodes.find((n) => n.id === edge.target);
        if (targetNode) {
          await traverseNode(supabase, targetNode, nodes, edges, ctx);
        }
      }
      return;
    }
  }

  // Record step start
  const stepId = await createStepExecution(supabase, ctx.executionId, node.id, node.type, 'running');

  try {
    let output: Record<string, unknown> = {};
    let nextEdgeFilter: string | undefined;

    switch (node.type) {
      case 'start': {
        // Start node just passes through
        break;
      }

      case 'end': {
        // End node — update context and return
        await updateStepStatus(supabase, stepId, 'completed', output);
        await updateContextData(supabase, ctx.executionId, ctx.contextData);
        return;
      }

      case 'action': {
        const actionType = node.data.config.action_type as string;
        const actionConfig = node.data.config.config as Record<string, unknown> || node.data.config;
        const action: AutomationAction = {
          type: actionType as AutomationAction['type'],
          config: actionConfig,
        };
        // Reuse existing automation action executor
        const result = await executeAction(action, {
          projectId: ctx.projectId,
          entityType: ((ctx.contextData.entity_type as string) || 'organization') as AutomationEntityType,
          entityId: (ctx.contextData.entity_id as string) || '',
          data: ctx.contextData,
          automationId: `workflow-${ctx.workflowId}`,
          automationName: 'Workflow execution',
        });
        output = result as unknown as Record<string, unknown>;
        break;
      }

      case 'ai_agent': {
        // TODO: Call OpenRouter with prompt + context
        const prompt = node.data.config.prompt as string;
        const outputKey = (node.data.config.output_key as string) || 'ai_response';
        output = { [outputKey]: `[AI response placeholder for: ${prompt}]` };
        ctx.contextData[outputKey] = output[outputKey];
        break;
      }

      case 'condition': {
        const field = node.data.config.field as string;
        const operator = node.data.config.operator as string;
        const value = node.data.config.value;

        // Resolve field value from context
        const fieldValue = resolveContextPath(ctx.contextData, field);
        const condition: AutomationCondition = {
          field: 'value',
          operator: operator as AutomationCondition['operator'],
          value,
        };
        const result = evaluateConditions([condition], { value: fieldValue });
        nextEdgeFilter = result ? 'true' : 'false';
        output = { result, field, fieldValue };
        break;
      }

      case 'switch': {
        const field = node.data.config.field as string;
        const cases = (node.data.config.cases as Array<{ value: unknown; label: string }>) || [];
        const defaultLabel = (node.data.config.default_label as string) || 'default';

        const fieldValue = resolveContextPath(ctx.contextData, field);
        // Use loose equality to handle string/number coercion (e.g., "1" == 1)
        // eslint-disable-next-line eqeqeq
        const matchedCase = cases.find((c) => c.value == fieldValue);
        nextEdgeFilter = matchedCase ? matchedCase.label : defaultLabel;
        output = { matched_case: nextEdgeFilter, field, fieldValue };
        break;
      }

      case 'delay': {
        const delayType = (node.data.config.delay_type as string) || 'duration';
        if (delayType === 'duration') {
          const durationMs = (node.data.config.duration_ms as number) || 0;
          if (durationMs > 0) {
            const scheduledFor = new Date(Date.now() + durationMs).toISOString();
            await updateStepStatusWithSchedule(supabase, stepId, 'waiting', scheduledFor);
            ctx.hasPendingDelay = true;
            return; // Stop execution here — cron will resume
          }
        } else if (delayType === 'until_date') {
          const untilDate = node.data.config.until_date as string;
          if (untilDate) {
            const target = new Date(untilDate);
            if (target.getTime() > Date.now()) {
              await updateStepStatusWithSchedule(supabase, stepId, 'waiting', target.toISOString());
              ctx.hasPendingDelay = true;
              return; // Stop execution here — cron will resume
            }
            // Date already passed — continue immediately
          }
        } else if (delayType === 'until_field') {
          const fieldPath = node.data.config.field_path as string;
          if (fieldPath) {
            // Resolve field from context data
            const parts = fieldPath.replace(/^context\./, '').split('.');
            let value: unknown = ctx.contextData;
            for (const p of parts) {
              if (value && typeof value === 'object') value = (value as Record<string, unknown>)[p];
              else { value = undefined; break; }
            }
            if (typeof value === 'string') {
              const target = new Date(value);
              if (!isNaN(target.getTime()) && target.getTime() > Date.now()) {
                await updateStepStatusWithSchedule(supabase, stepId, 'waiting', target.toISOString());
                ctx.hasPendingDelay = true;
                return;
              }
            }
          }
        }
        break;
      }

      case 'loop': {
        const collectionPath = node.data.config.collection_path as string;
        const itemKey = (node.data.config.item_key as string) || 'item';
        const maxIterations = (node.data.config.max_iterations as number) || 100;

        const collection = resolveContextPath(ctx.contextData, collectionPath);
        if (Array.isArray(collection)) {
          const items = collection.slice(0, maxIterations);
          const wasInsideLoop = ctx.insideLoop;
          ctx.insideLoop = true;
          for (const item of items) {
            ctx.contextData[itemKey] = item;
            // Execute the loop body (next nodes)
            const outEdges = edges.filter((e) => e.source === node.id);
            for (const edge of outEdges) {
              const targetNode = nodes.find((n) => n.id === edge.target);
              if (targetNode) {
                await traverseNode(supabase, targetNode, nodes, edges, ctx);
              }
            }
          }
          ctx.insideLoop = wasInsideLoop;
          await updateStepStatus(supabase, stepId, 'completed', { iterations: items.length });
          return; // Loop handles its own traversal
        }
        break;
      }

      case 'sub_workflow': {
        const inlineDef = node.data.config.inline_definition as WorkflowDefinition | undefined;
        if (inlineDef) {
          // Prefix sub-workflow node IDs to avoid collisions with parent execution
          const prefix = `${node.id}__`;
          const prefixedDef: WorkflowDefinition = {
            schema_version: inlineDef.schema_version,
            nodes: inlineDef.nodes.map((n) => ({ ...n, id: `${prefix}${n.id}` })),
            edges: inlineDef.edges.map((e) => ({
              ...e,
              id: `${prefix}${e.id}`,
              source: `${prefix}${e.source}`,
              target: `${prefix}${e.target}`,
            })),
          };
          await executeWorkflow(
            ctx.workflowId,
            ctx.executionId,
            ctx.projectId,
            prefixedDef,
            ctx.contextData,
            ctx.depth + 1
          );
        }
        // TODO: Handle workflow_id reference
        break;
      }

      case 'webhook': {
        const { executeWebhook } = await import('./executors/webhook-executor');
        const outputKey = (node.data.config.output_key as string) || 'webhook_response';
        const webhookResult = await executeWebhook(node, ctx.contextData);
        output = { [outputKey]: webhookResult.body, status: webhookResult.status };
        ctx.contextData[outputKey] = webhookResult.body as Record<string, unknown>;
        break;
      }

      case 'mcp_tool': {
        const { executeMcpTool } = await import('./executors/mcp-executor');
        const mcpResult = await executeMcpTool(node, ctx.contextData, ctx.projectId);
        output = { tool: mcpResult.tool_name, mode: mcpResult.mode, result: mcpResult.result };
        const mcpOutputKey = (node.data.config.output_key as string) || 'mcp_result';
        ctx.contextData[mcpOutputKey] = mcpResult.result as Record<string, unknown>;
        break;
      }

      case 'zapier': {
        const { executeZapierAction } = await import('./executors/zapier-executor');
        const zapierResult = await executeZapierAction(node, ctx.contextData, ctx.projectId);
        output = { action: zapierResult.action, result: zapierResult.result };
        const zapOutputKey = (node.data.config.output_key as string) || 'zapier_result';
        ctx.contextData[zapOutputKey] = zapierResult.result as Record<string, unknown>;
        break;
      }
    }

    await updateStepStatus(supabase, stepId, 'completed', output);

    // Traverse to next nodes
    const outEdges = edges.filter((e) => {
      if (e.source !== node.id) return false;
      if (nextEdgeFilter !== undefined) {
        return e.sourceHandle === nextEdgeFilter;
      }
      return true;
    });

    for (const edge of outEdges) {
      const targetNode = nodes.find((n) => n.id === edge.target);
      if (targetNode) {
        await traverseNode(supabase, targetNode, nodes, edges, ctx);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Step failed';
    await updateStepStatus(supabase, stepId, 'failed', { error: message });

    // Check retry config
    const retry = node.data.retry;
    if (retry && retry.max_retries > 0) {
      // TODO: Implement retry with backoff
    }

    throw error; // Propagate to execution level
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function resolveContextPath(context: Record<string, unknown>, path: string): unknown {
  const parts = path.replace(/^context\./, '').split('.');
  let current: unknown = context;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

async function createStepExecution(
  supabase: ReturnType<typeof createAdminClient>,
  executionId: string,
  nodeId: string,
  nodeType: string,
  status: StepExecutionStatus
): Promise<string> {
  const { data, error } = await supabase
    .from('workflow_step_executions')
    .insert({
      execution_id: executionId,
      node_id: nodeId,
      node_type: nodeType,
      status,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw new Error(`Failed to create step execution: ${error?.message || 'no id returned'}`);
  }

  return data.id;
}

async function updateStepStatus(
  supabase: ReturnType<typeof createAdminClient>,
  stepId: string,
  status: StepExecutionStatus,
  outputData?: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from('workflow_step_executions')
    .update({
      status,
      output_data: outputData || null,
      completed_at: ['completed', 'failed', 'skipped'].includes(status) ? new Date().toISOString() : null,
    })
    .eq('id', stepId);
  if (error) console.error(`Failed to update step ${stepId} status:`, error.message);
}

async function updateStepStatusWithSchedule(
  supabase: ReturnType<typeof createAdminClient>,
  stepId: string,
  status: StepExecutionStatus,
  scheduledFor: string
): Promise<void> {
  await supabase
    .from('workflow_step_executions')
    .update({ status, scheduled_for: scheduledFor })
    .eq('id', stepId);
}

async function updateExecutionStatus(
  supabase: ReturnType<typeof createAdminClient>,
  executionId: string,
  status: WorkflowExecutionStatus,
  errorMessage?: string
): Promise<void> {
  const { error } = await supabase
    .from('workflow_executions')
    .update({
      status,
      error_message: errorMessage || null,
      completed_at: ['completed', 'failed', 'cancelled'].includes(status) ? new Date().toISOString() : null,
    })
    .eq('id', executionId);
  if (error) console.error(`Failed to update execution ${executionId} status:`, error.message);
}

async function updateContextData(
  supabase: ReturnType<typeof createAdminClient>,
  executionId: string,
  contextData: Record<string, unknown>
): Promise<void> {
  await supabase
    .from('workflow_executions')
    .update({ context_data: contextData })
    .eq('id', executionId);
}

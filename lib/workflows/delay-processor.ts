/**
 * Delay processor — resumes workflow steps that have reached their scheduled time
 * Called by cron endpoint: /api/cron/workflow-delays
 */

import { createClient } from '@supabase/supabase-js';
import { executeWorkflow } from './engine';
import type { WorkflowDefinition } from '@/types/workflow';
import type { Json } from '@/types/database';

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export interface DelayProcessorResult {
  processed: number;
  failed: number;
  errors: string[];
  scheduled_triggered?: number;
}

/**
 * Process all waiting workflow steps that have reached their scheduled time.
 * For each ready step, resumes execution from the delay node's next edge.
 */
export async function processDelayedSteps(): Promise<DelayProcessorResult> {
  const supabase = createAdminClient();
  const result: DelayProcessorResult = { processed: 0, failed: 0, errors: [] };

  // Find all waiting steps whose scheduled time has passed
  const { data: waitingSteps, error } = await supabase
    .from('workflow_step_executions')
    .select(`
      id,
      execution_id,
      node_id,
      workflow_executions!inner (
        id,
        workflow_id,
        workflow_version,
        context_data,
        status
      )
    `)
    .eq('status', 'waiting')
    .lte('scheduled_for', new Date().toISOString())
    .limit(50); // Process in batches

  if (error) {
    result.errors.push(`Failed to query waiting steps: ${error.message}`);
    return result;
  }

  if (!waitingSteps || waitingSteps.length === 0) {
    return result;
  }

  for (const step of waitingSteps) {
    try {
      const execution = step.workflow_executions as unknown as {
        id: string;
        workflow_id: string;
        workflow_version: number;
        context_data: Json;
        status: string;
      };

      // Skip if execution is no longer running
      if (execution.status !== 'running' && execution.status !== 'paused') {
        await supabase
          .from('workflow_step_executions')
          .update({ status: 'skipped', completed_at: new Date().toISOString() })
          .eq('id', step.id);
        continue;
      }

      // Mark the step as completed
      await supabase
        .from('workflow_step_executions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          output_data: { resumed_at: new Date().toISOString() } as unknown as Json,
        })
        .eq('id', step.id);

      // Load the workflow definition
      const { data: workflow } = await supabase
        .from('workflows')
        .select('definition, project_id')
        .eq('id', execution.workflow_id)
        .single();

      if (!workflow) {
        result.errors.push(`Workflow not found for execution ${execution.id}`);
        result.failed++;
        continue;
      }

      const definition = workflow.definition as unknown as WorkflowDefinition;
      const contextData = (execution.context_data as Record<string, unknown>) || {};

      // Find the delay node and its outgoing edges to determine next nodes
      const delayNode = definition.nodes.find((n) => n.id === step.node_id);
      if (!delayNode) {
        result.errors.push(`Delay node ${step.node_id} not found in workflow definition`);
        result.failed++;
        continue;
      }

      // Re-execute the workflow from this point by creating a continuation
      // We mark the execution as running again and resume from after the delay
      await supabase
        .from('workflow_executions')
        .update({ status: 'running' })
        .eq('id', execution.id);

      // Re-run the full workflow — the engine will skip already-completed steps
      // by checking step status before executing
      await executeWorkflow(
        execution.workflow_id,
        execution.id,
        workflow.project_id,
        definition,
        contextData
      );

      result.processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`Failed to process step ${step.id}: ${message}`);
      result.failed++;

      // Mark step as failed
      await supabase
        .from('workflow_step_executions')
        .update({
          status: 'failed',
          error_message: message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', step.id);
    }
  }

  return result;
}

/**
 * Process scheduled workflows — triggers active workflows with trigger_type='schedule'
 * whose cron expression matches the current minute.
 *
 * trigger_config format: { cron: "0 9 * * 1" } (standard 5-field cron)
 * Also supports: { interval_minutes: 60 } for simple repeating intervals.
 */
export async function processScheduledWorkflows(): Promise<{ triggered: number; errors: string[] }> {
  const supabase = createAdminClient();
  const result = { triggered: 0, errors: [] as string[] };

  const { data: scheduledWorkflows, error } = await supabase
    .from('workflows')
    .select('id, project_id, current_version, definition, trigger_config')
    .eq('trigger_type', 'schedule')
    .eq('is_active', true);

  if (error) {
    result.errors.push(`Failed to query scheduled workflows: ${error.message}`);
    return result;
  }

  if (!scheduledWorkflows || scheduledWorkflows.length === 0) return result;

  const now = new Date();

  for (const wf of scheduledWorkflows) {
    try {
      const config = wf.trigger_config as { cron?: string; interval_minutes?: number; last_run?: string };
      let shouldTrigger = false;

      if (config.cron) {
        // Simple 5-field cron matching (minute, hour, day-of-month, month, day-of-week)
        shouldTrigger = matchesCron(config.cron, now);
      } else if (config.interval_minutes) {
        // Interval-based: check if enough time has passed since last run
        const lastRun = config.last_run ? new Date(config.last_run) : new Date(0);
        const elapsed = (now.getTime() - lastRun.getTime()) / 60000;
        shouldTrigger = elapsed >= config.interval_minutes;
      }

      if (!shouldTrigger) continue;

      // Use RPC for atomic execution creation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: executionId, error: rpcError } = await (supabase as any).rpc('log_workflow_execution', {
        p_workflow_id: wf.id,
        p_workflow_version: wf.current_version,
        p_trigger_event: { type: 'schedule', triggered_at: now.toISOString() },
        p_status: 'running',
      });

      if (rpcError || !executionId) {
        result.errors.push(`Failed to create execution for ${wf.id}: ${rpcError?.message}`);
        continue;
      }

      // Update last_run timestamp in trigger_config
      await supabase
        .from('workflows')
        .update({
          trigger_config: { ...config, last_run: now.toISOString() } as unknown as Json,
        })
        .eq('id', wf.id);

      const definition = wf.definition as unknown as WorkflowDefinition;

      // Fire and forget
      executeWorkflow(wf.id, executionId, wf.project_id, definition, {}).catch((err) =>
        console.error(`Scheduled workflow ${wf.id} execution failed:`, err)
      );

      result.triggered++;
    } catch (err) {
      result.errors.push(`Error processing scheduled workflow ${wf.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}

/**
 * Simple 5-field cron matcher (minute hour dom month dow)
 * Supports: numbers, *, and step values (e.g. *​/5)
 */
function matchesCron(expr: string, date: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const values = [
    date.getMinutes(),   // 0-59
    date.getHours(),     // 0-23
    date.getDate(),      // 1-31
    date.getMonth() + 1, // 1-12
    date.getDay(),       // 0-6 (Sun=0)
  ];

  // Fields 2 (dom) and 3 (month) are 1-based; fields 0 (min), 1 (hour), 4 (dow) are 0-based
  const oneBasedFields = [false, false, true, true, false];
  return parts.every((part, i) => matchesCronField(part!, values[i]!, oneBasedFields[i]!));
}

function matchesCronField(field: string, value: number, oneBased = false): boolean {
  if (field === '*') return true;

  // Handle step: */N — for 1-based fields use (value - 1) % step === 0
  if (field.startsWith('*/')) {
    const step = parseInt(field.slice(2), 10);
    if (isNaN(step) || step <= 0) return false;
    return oneBased ? (value - 1) % step === 0 : value % step === 0;
  }

  // Handle comma-separated values
  return field.split(',').some((part) => {
    // Handle range: N-M
    if (part.includes('-')) {
      const [start, end] = part.split('-').map((s) => parseInt(s, 10));
      if (start !== undefined && end !== undefined && !isNaN(start) && !isNaN(end)) {
        return value >= start && value <= end;
      }
      return false;
    }
    // Exact match
    return parseInt(part, 10) === value;
  });
}

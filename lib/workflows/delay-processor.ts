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

import { createClient } from '@supabase/supabase-js';
import { evaluateConditions } from './conditions';
import { executeAction } from './actions';
import type {
  AutomationEvent,
  AutomationCondition,
  AutomationAction,
  AutomationEntityType,
  TriggerConfig,
} from '@/types/automation';

// Loop detection: track recent executions to prevent infinite loops
const recentExecutions = new Map<string, number>();
const MAX_CHAIN_DEPTH = 3;
const COOLDOWN_MS = 60_000;

// Current chain depth (incremented when an action triggers another automation)
let currentChainDepth = 0;

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

/**
 * Check if a trigger config matches the incoming event
 */
function matchesTriggerConfig(
  triggerConfig: TriggerConfig,
  event: AutomationEvent
): boolean {
  // Check entity_type if specified in trigger config
  if (triggerConfig.entity_type && triggerConfig.entity_type !== event.entityType) {
    return false;
  }

  // Check field.changed specific config
  if (event.triggerType === 'field.changed' && triggerConfig.field_name) {
    const fieldName = triggerConfig.field_name;
    const currentValue = event.data[fieldName];
    const previousValue = event.previousData?.[fieldName];

    const norm = (v: unknown) => (v == null ? null : String(v));

    // Field must have actually changed
    if (norm(currentValue) === norm(previousValue)) return false;

    // If to_value is specified, check it matches
    if (triggerConfig.to_value !== undefined && norm(currentValue) !== norm(triggerConfig.to_value)) {
      return false;
    }
  }

  // Check stage change config
  if (event.triggerType === 'opportunity.stage_changed') {
    if (triggerConfig.from_stage && String(event.previousData?.stage) !== triggerConfig.from_stage) {
      return false;
    }
    if (triggerConfig.to_stage && String(event.data.stage) !== triggerConfig.to_stage) {
      return false;
    }
  }

  // Check status change config
  if (event.triggerType === 'rfp.status_changed') {
    if (triggerConfig.from_status && String(event.previousData?.status) !== triggerConfig.from_status) {
      return false;
    }
    if (triggerConfig.to_status && String(event.data.status) !== triggerConfig.to_status) {
      return false;
    }
  }

  // Check call disposition filter
  if (event.triggerType === 'call.dispositioned' && triggerConfig.disposition) {
    if (event.data.disposition !== triggerConfig.disposition) return false;
  }

  // Check call direction filter
  if (triggerConfig.direction && event.data.direction !== triggerConfig.direction) {
    return false;
  }

  // Check sequence_id filter
  if (triggerConfig.sequence_id && event.metadata?.sequence_id !== triggerConfig.sequence_id) {
    return false;
  }

  // Check meeting_type filter
  if (triggerConfig.meeting_type && event.data.meeting_type !== triggerConfig.meeting_type) {
    return false;
  }

  // Check outcome filter
  if (triggerConfig.outcome && event.data.outcome !== triggerConfig.outcome) {
    return false;
  }

  return true;
}

/**
 * Main entry point: emit an automation event.
 * Called from API routes after entity mutations.
 * Non-blocking — errors are logged but don't propagate.
 */
export async function emitAutomationEvent(event: AutomationEvent): Promise<void> {
  // Don't block the caller
  processAutomationEvent(event).catch((error) => {
    console.error('[Automation] Error processing event:', error);
  });
}

/**
 * Process an automation event (internal)
 */
async function processAutomationEvent(event: AutomationEvent): Promise<void> {
  // Loop detection: check chain depth
  if (currentChainDepth >= MAX_CHAIN_DEPTH) {
    console.warn('[Automation] Max chain depth reached, skipping event:', event.triggerType);
    return;
  }

  const supabase = createAdminClient();

  // Fetch active automations matching this trigger type
  const { data: automations, error } = await supabase
    .rpc('get_automations_for_trigger', {
      p_project_id: event.projectId,
      p_trigger_type: event.triggerType,
    });

  if (error) {
    console.error('[Automation] Error fetching automations:', error);
    return;
  }

  if (!automations || automations.length === 0) return;

  for (const automation of automations) {
    const executionKey = `${automation.id}:${event.entityId}`;

    // Cooldown check: prevent re-firing same automation on same entity within cooldown
    const lastExecution = recentExecutions.get(executionKey);
    if (lastExecution && Date.now() - lastExecution < COOLDOWN_MS) {
      console.log(`[Automation] Cooldown active for ${automation.name} on ${event.entityId}, skipping`);
      continue;
    }

    await executeAutomation(supabase, automation, event);
  }
}

/**
 * Execute a single automation against an event
 */
async function executeAutomation(
  supabase: ReturnType<typeof createAdminClient>,
  automation: {
    id: string;
    name: string;
    trigger_type: string;
    trigger_config: TriggerConfig;
    conditions: AutomationCondition[];
    actions: AutomationAction[];
  },
  event: AutomationEvent
): Promise<void> {
  const startTime = Date.now();
  const executionKey = `${automation.id}:${event.entityId}`;

  try {
    // Check if trigger config matches
    if (!matchesTriggerConfig(automation.trigger_config, event)) {
      return; // Silent skip — trigger config didn't match
    }

    // Evaluate conditions
    const conditionsMet = evaluateConditions(automation.conditions, event.data);

    if (!conditionsMet) {
      // Log as skipped
      await supabase.rpc('log_automation_execution', {
        p_automation_id: automation.id,
        p_trigger_event: event as unknown as Record<string, unknown>,
        p_conditions_met: false,
        p_actions_results: JSON.stringify([]),
        p_status: 'skipped',
        p_error_message: 'Conditions not met',
        p_duration_ms: Date.now() - startTime,
        p_entity_type: event.entityType,
        p_entity_id: event.entityId,
      });
      return;
    }

    // Mark this execution in cooldown map
    recentExecutions.set(executionKey, Date.now());

    // Execute actions sequentially
    currentChainDepth++;
    const actionResults = [];
    let hasFailure = false;

    try {
      for (const action of automation.actions) {
        const result = await executeAction(action, {
          projectId: event.projectId,
          entityType: event.entityType,
          entityId: event.entityId,
          data: event.data,
          automationId: automation.id,
          automationName: automation.name,
        });

        actionResults.push(result);
        if (!result.success) hasFailure = true;
      }
    } finally {
      currentChainDepth = Math.max(0, currentChainDepth - 1);
    }

    // Determine overall status
    const allFailed = actionResults.every((r) => !r.success);
    const status = allFailed ? 'failed' : hasFailure ? 'partial_failure' : 'success';

    // Log execution
    await supabase.rpc('log_automation_execution', {
      p_automation_id: automation.id,
      p_trigger_event: {
        triggerType: event.triggerType,
        entityType: event.entityType,
        entityId: event.entityId,
      },
      p_conditions_met: true,
      p_actions_results: JSON.stringify(actionResults),
      p_status: status,
      p_error_message: hasFailure
        ? actionResults.filter((r) => !r.success).map((r) => r.error).join('; ')
        : null,
      p_duration_ms: Date.now() - startTime,
      p_entity_type: event.entityType,
      p_entity_id: event.entityId,
    });
  } catch (error) {
    console.error(`[Automation] Error executing automation ${automation.name}:`, error);

    // Log the error (ignore log failures)
    try {
      await supabase.rpc('log_automation_execution', {
        p_automation_id: automation.id,
        p_trigger_event: {
          triggerType: event.triggerType,
          entityType: event.entityType,
          entityId: event.entityId,
        },
        p_conditions_met: true,
        p_actions_results: JSON.stringify([]),
        p_status: 'failed',
        p_error_message: error instanceof Error ? error.message : 'Unknown error',
        p_duration_ms: Date.now() - startTime,
        p_entity_type: event.entityType,
        p_entity_id: event.entityId,
      });
    } catch { /* don't fail on log failure */ }
  }
}

/**
 * Dry-run an automation: evaluate trigger config and conditions against real entity data,
 * return what would happen without executing actions.
 */
export async function dryRunAutomation(
  automationId: string,
  entityType: AutomationEntityType,
  entityId: string,
  projectId: string
): Promise<{
  would_trigger: boolean;
  conditions_met: boolean;
  actions: Array<{ type: string; config: Record<string, unknown> }>;
  entity_data: Record<string, unknown>;
}> {
  const supabase = createAdminClient();

  // Fetch automation
  const { data: automation, error: automationError } = await supabase
    .from('automations')
    .select('*')
    .eq('id', automationId)
    .eq('project_id', projectId)
    .single();

  if (automationError || !automation) {
    throw new Error('Automation not found');
  }

  // Fetch entity data
  const entityTableMap: Record<string, string> = {
    organization: 'organizations',
    person: 'people',
    opportunity: 'opportunities',
    rfp: 'rfps',
    task: 'tasks',
    meeting: 'meetings',
    call: 'calls',
  };

  const tableName = entityTableMap[entityType];
  if (!tableName) throw new Error(`Unknown entity type: ${entityType}`);

  const { data: entity, error: entityError } = await supabase
    .from(tableName)
    .select('*')
    .eq('id', entityId)
    .eq('project_id', projectId)
    .single();

  if (entityError || !entity) {
    throw new Error('Entity not found');
  }

  const entityData = entity as Record<string, unknown>;
  const conditions = automation.conditions as AutomationCondition[];
  const conditionsMet = evaluateConditions(conditions, entityData);

  return {
    would_trigger: conditionsMet,
    conditions_met: conditionsMet,
    actions: (automation.actions as AutomationAction[]).map((a) => ({
      type: a.type,
      config: a.config,
    })),
    entity_data: entityData,
  };
}

// Clean up stale cooldown entries periodically
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, time] of recentExecutions.entries()) {
    if (now - time > COOLDOWN_MS * 2) {
      recentExecutions.delete(key);
    }
  }
}, COOLDOWN_MS);
// Don't prevent process exit in serverless environments
if (typeof cleanupInterval.unref === 'function') cleanupInterval.unref();

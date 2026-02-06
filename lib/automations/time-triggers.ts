import { createClient } from '@supabase/supabase-js';
import { emitAutomationEvent } from './engine';
import type { TriggerConfig, AutomationEntityType, TriggerType } from '@/types/automation';
import { timeTriggerTypes } from '@/types/automation';

interface TimeTriggerResult {
  processed: number;
  matched: number;
  errors: number;
  details: Array<{
    automationId: string;
    automationName: string;
    matchedEntities: number;
    error?: string;
  }>;
}

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

// Map entity types to table names
const entityTableMap: Record<string, string> = {
  organization: 'organizations',
  person: 'people',
  opportunity: 'opportunities',
  rfp: 'rfps',
  task: 'tasks',
  meeting: 'meetings',
};

/**
 * Process all time-based automation triggers
 */
export async function processTimeTriggers(limit = 200): Promise<TimeTriggerResult> {
  const supabase = createAdminClient();
  const result: TimeTriggerResult = {
    processed: 0,
    matched: 0,
    errors: 0,
    details: [],
  };

  // Fetch active time-based automations
  const { data: automations, error } = await supabase
    .from('automations')
    .select('*')
    .eq('is_active', true)
    .in('trigger_type', timeTriggerTypes)
    .limit(limit);

  if (error) {
    console.error('[TimeTriggers] Error fetching automations:', error);
    throw new Error('Failed to fetch time-based automations');
  }

  if (!automations || automations.length === 0) return result;

  for (const automation of automations) {
    result.processed++;

    try {
      const matchedEntities = await processTimeAutomation(supabase, automation);
      result.matched += matchedEntities;
      result.details.push({
        automationId: automation.id,
        automationName: automation.name,
        matchedEntities,
      });
    } catch (err) {
      result.errors++;
      result.details.push({
        automationId: automation.id,
        automationName: automation.name,
        matchedEntities: 0,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return result;
}

async function processTimeAutomation(
  supabase: ReturnType<typeof createAdminClient>,
  automation: Record<string, unknown>
): Promise<number> {
  const triggerType = automation.trigger_type as TriggerType;
  const triggerConfig = automation.trigger_config as TriggerConfig;
  const projectId = automation.project_id as string;

  // Get or create time check record for deduplication
  const { data: timeCheck } = await supabase
    .from('automation_time_checks')
    .select('*')
    .eq('automation_id', automation.id)
    .single();

  const previouslyMatchedIds: string[] = (timeCheck?.last_matched_entity_ids as string[]) ?? [];

  // Find matching entities based on trigger type
  let matchedEntityIds: string[] = [];

  switch (triggerType) {
    case 'time.entity_inactive':
      matchedEntityIds = await findInactiveEntities(supabase, projectId, triggerConfig);
      break;
    case 'time.task_overdue':
      matchedEntityIds = await findOverdueTasks(supabase, projectId);
      break;
    case 'time.close_date_approaching':
      matchedEntityIds = await findApproachingCloseDate(supabase, projectId, triggerConfig);
      break;
    case 'time.created_ago':
      matchedEntityIds = await findCreatedAgo(supabase, projectId, triggerConfig);
      break;
    default:
      return 0;
  }

  // Filter out already-notified entities
  const newEntityIds = matchedEntityIds.filter((id) => !previouslyMatchedIds.includes(id));

  // Emit events for new matches
  const entityType = getEntityTypeForTrigger(triggerType, triggerConfig);
  const tableName = entityTableMap[entityType];
  if (!tableName) return 0;

  for (const entityId of newEntityIds) {
    // Fetch entity data
    const { data: entity } = await supabase
      .from(tableName!)
      .select('*')
      .eq('id', entityId)
      .single();

    if (entity) {
      emitAutomationEvent({
        projectId,
        triggerType,
        entityType: entityType as AutomationEntityType,
        entityId,
        data: entity as Record<string, unknown>,
      });
    }
  }

  // Update time check record
  const allMatchedIds = [...new Set([...previouslyMatchedIds, ...newEntityIds])];

  if (timeCheck) {
    await supabase
      .from('automation_time_checks')
      .update({
        last_checked_at: new Date().toISOString(),
        last_matched_entity_ids: allMatchedIds,
      })
      .eq('automation_id', automation.id);
  } else {
    await supabase
      .from('automation_time_checks')
      .insert({
        automation_id: automation.id,
        last_checked_at: new Date().toISOString(),
        last_matched_entity_ids: allMatchedIds,
      });
  }

  return newEntityIds.length;
}

function getEntityTypeForTrigger(triggerType: TriggerType, config: TriggerConfig): string {
  switch (triggerType) {
    case 'time.entity_inactive':
    case 'time.created_ago':
      return config.entity_type || 'organization';
    case 'time.task_overdue':
      return 'task';
    case 'time.close_date_approaching':
      return 'opportunity';
    default:
      return 'organization';
  }
}

async function findInactiveEntities(
  supabase: ReturnType<typeof createAdminClient>,
  projectId: string,
  config: TriggerConfig
): Promise<string[]> {
  const rawDays = config.days ?? 30;
  const days = Math.min(Math.max(Math.floor(rawDays), 1), 365);
  const entityType = config.entity_type ?? 'organization';
  const tableName = entityTableMap[entityType];
  if (!tableName) return [];

  const cutoffDate = new Date(Date.now() - days * 86400000).toISOString();

  const { data } = await supabase
    .from(tableName)
    .select('id')
    .eq('project_id', projectId)
    .lt('updated_at', cutoffDate)
    .is('deleted_at', null)
    .limit(100);

  return (data ?? []).map((r: { id: string }) => r.id);
}

async function findOverdueTasks(
  supabase: ReturnType<typeof createAdminClient>,
  projectId: string
): Promise<string[]> {
  const now = new Date().toISOString();

  const { data } = await supabase
    .from('tasks')
    .select('id')
    .eq('project_id', projectId)
    .lt('due_date', now)
    .in('status', ['pending', 'in_progress'])
    .limit(100);

  return (data ?? []).map((r: { id: string }) => r.id);
}

async function findApproachingCloseDate(
  supabase: ReturnType<typeof createAdminClient>,
  projectId: string,
  config: TriggerConfig
): Promise<string[]> {
  const daysBefore = config.days_before ?? 7;
  const now = new Date();
  const targetDate = new Date(now.getTime() + daysBefore * 86400000);

  const { data } = await supabase
    .from('opportunities')
    .select('id')
    .eq('project_id', projectId)
    .gte('expected_close_date', now.toISOString())
    .lte('expected_close_date', targetDate.toISOString())
    .not('stage', 'in', '("closed_won","closed_lost")')
    .is('deleted_at', null)
    .limit(100);

  return (data ?? []).map((r: { id: string }) => r.id);
}

async function findCreatedAgo(
  supabase: ReturnType<typeof createAdminClient>,
  projectId: string,
  config: TriggerConfig
): Promise<string[]> {
  const rawDays = config.days ?? 7;
  const days = Math.min(Math.max(Math.floor(rawDays), 1), 365);
  const entityType = config.entity_type ?? 'organization';
  const tableName = entityTableMap[entityType];
  if (!tableName) return [];

  // Find entities created exactly X days ago (within a 24-hour window)
  const targetStart = new Date(Date.now() - days * 86400000);
  const targetEnd = new Date(Date.now() - (days - 1) * 86400000);

  const { data } = await supabase
    .from(tableName)
    .select('id')
    .eq('project_id', projectId)
    .gte('created_at', targetStart.toISOString())
    .lt('created_at', targetEnd.toISOString())
    .is('deleted_at', null)
    .limit(100);

  return (data ?? []).map((r: { id: string }) => r.id);
}

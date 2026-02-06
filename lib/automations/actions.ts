import { createClient } from '@supabase/supabase-js';
import type { AutomationAction, AutomationEntityType } from '@/types/automation';

interface ActionContext {
  projectId: string;
  entityType: AutomationEntityType;
  entityId: string;
  data: Record<string, unknown>;
  automationId: string;
  automationName: string;
}

interface ActionResult {
  action_type: string;
  success: boolean;
  error?: string;
  result?: Record<string, unknown>;
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
const entityTableMap: Record<AutomationEntityType, string> = {
  organization: 'organizations',
  person: 'people',
  opportunity: 'opportunities',
  rfp: 'rfps',
  task: 'tasks',
  meeting: 'meetings',
  call: 'calls',
};

/**
 * Execute a single automation action
 */
export async function executeAction(
  action: AutomationAction,
  context: ActionContext
): Promise<ActionResult> {
  try {
    switch (action.type) {
      case 'create_task':
        return await executeCreateTask(action, context);
      case 'update_field':
        return await executeUpdateField(action, context);
      case 'change_stage':
        return await executeChangeStage(action, context);
      case 'change_status':
        return await executeChangeStatus(action, context);
      case 'assign_owner':
        return await executeAssignOwner(action, context);
      case 'send_notification':
        return await executeSendNotification(action, context);
      case 'send_email':
        return await executeSendEmail(action, context);
      case 'enroll_in_sequence':
        return await executeEnrollInSequence(action, context);
      case 'add_tag':
        return await executeAddTag(action, context);
      case 'remove_tag':
        return await executeRemoveTag(action, context);
      case 'create_activity':
        return await executeCreateActivity(action, context);
      case 'run_ai_research':
        return await executeRunAiResearch(action, context);
      case 'fire_webhook':
        return await executeFireWebhook(action, context);
      default:
        return { action_type: action.type, success: false, error: `Unknown action type: ${action.type}` };
    }
  } catch (error) {
    return {
      action_type: action.type,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function executeCreateTask(
  action: AutomationAction,
  context: ActionContext
): Promise<ActionResult> {
  const supabase = createAdminClient();
  const config = action.config;

  const dueDate = config.due_in_days
    ? new Date(Date.now() + Number(config.due_in_days) * 86400000).toISOString()
    : null;

  // Build entity link fields
  const entityLinks: Record<string, string> = {};
  if (context.entityType === 'person') entityLinks.person_id = context.entityId;
  else if (context.entityType === 'organization') entityLinks.organization_id = context.entityId;
  else if (context.entityType === 'opportunity') entityLinks.opportunity_id = context.entityId;
  else if (context.entityType === 'rfp') entityLinks.rfp_id = context.entityId;

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      project_id: context.projectId,
      title: String(config.title || `Auto-task: ${context.automationName}`),
      description: config.description ? String(config.description) : null,
      priority: String(config.priority || 'medium'),
      status: 'pending',
      due_date: dueDate,
      assigned_to: config.assign_to ? String(config.assign_to) : null,
      ...entityLinks,
    })
    .select('id')
    .single();

  if (error) return { action_type: action.type, success: false, error: error.message };
  return { action_type: action.type, success: true, result: { task_id: data.id } };
}

async function executeUpdateField(
  action: AutomationAction,
  context: ActionContext
): Promise<ActionResult> {
  const supabase = createAdminClient();
  const config = action.config;
  const fieldName = String(config.field_name || '');
  const value = config.value;

  if (!fieldName) return { action_type: action.type, success: false, error: 'No field_name specified' };

  const tableName = entityTableMap[context.entityType];
  if (!tableName) return { action_type: action.type, success: false, error: `Unknown entity type: ${context.entityType}` };

  // Allowlist of fields that automations may update per entity type
  const ALLOWED_FIELDS: Record<string, string[]> = {
    organizations: ['name', 'domain', 'industry', 'website', 'phone', 'linkedin_url', 'description', 'address_street', 'address_city', 'address_state', 'address_postal_code', 'address_country'],
    people: ['first_name', 'last_name', 'email', 'phone', 'mobile_phone', 'job_title', 'department', 'linkedin_url', 'notes'],
    opportunities: ['name', 'amount', 'stage', 'expected_close_date', 'probability', 'description', 'lost_reason', 'won_reason'],
    rfps: ['title', 'status', 'due_date', 'description'],
    tasks: ['title', 'description', 'priority', 'status', 'due_date'],
    meetings: ['title', 'description', 'status', 'outcome_notes', 'next_steps'],
    calls: ['status', 'disposition', 'disposition_notes', 'duration_seconds'],
  };

  // Handle custom fields
  if (fieldName.startsWith('custom_fields.')) {
    const customFieldKey = fieldName.replace('custom_fields.', '');
    const currentCustomFields = (context.data.custom_fields as Record<string, unknown>) || {};
    const updatedCustomFields = { ...currentCustomFields, [customFieldKey]: value };

    const { error } = await supabase
      .from(tableName)
      .update({ custom_fields: updatedCustomFields })
      .eq('id', context.entityId)
      .eq('project_id', context.projectId);

    if (error) return { action_type: action.type, success: false, error: error.message };
    return { action_type: action.type, success: true, result: { field: fieldName, value } };
  }

  const allowedForTable = ALLOWED_FIELDS[tableName] || [];
  if (!allowedForTable.includes(fieldName)) {
    return { action_type: action.type, success: false, error: `Field "${fieldName}" is not allowed for ${context.entityType}` };
  }

  const { error } = await supabase
    .from(tableName)
    .update({ [fieldName]: value })
    .eq('id', context.entityId)
    .eq('project_id', context.projectId);

  if (error) return { action_type: action.type, success: false, error: error.message };
  return { action_type: action.type, success: true, result: { field: fieldName, value } };
}

async function executeChangeStage(
  action: AutomationAction,
  context: ActionContext
): Promise<ActionResult> {
  if (context.entityType !== 'opportunity') {
    return { action_type: action.type, success: false, error: 'change_stage only applies to opportunities' };
  }
  const supabase = createAdminClient();
  const stage = String(action.config.stage || '');
  if (!stage) return { action_type: action.type, success: false, error: 'No stage specified' };

  const { error } = await supabase
    .from('opportunities')
    .update({ stage })
    .eq('id', context.entityId)
    .eq('project_id', context.projectId);

  if (error) return { action_type: action.type, success: false, error: error.message };
  return { action_type: action.type, success: true, result: { stage } };
}

async function executeChangeStatus(
  action: AutomationAction,
  context: ActionContext
): Promise<ActionResult> {
  if (context.entityType !== 'rfp') {
    return { action_type: action.type, success: false, error: 'change_status only applies to RFPs' };
  }
  const supabase = createAdminClient();
  const status = String(action.config.status || '');
  if (!status) return { action_type: action.type, success: false, error: 'No status specified' };

  const { error } = await supabase
    .from('rfps')
    .update({ status })
    .eq('id', context.entityId)
    .eq('project_id', context.projectId);

  if (error) return { action_type: action.type, success: false, error: error.message };
  return { action_type: action.type, success: true, result: { status } };
}

async function executeAssignOwner(
  action: AutomationAction,
  context: ActionContext
): Promise<ActionResult> {
  const supabase = createAdminClient();
  const userId = String(action.config.user_id || '');
  if (!userId) return { action_type: action.type, success: false, error: 'No user_id specified' };

  const tableName = entityTableMap[context.entityType];
  if (!tableName) return { action_type: action.type, success: false, error: `Unknown entity type: ${context.entityType}` };

  const { data: membership } = await supabase
    .from('project_memberships')
    .select('id')
    .eq('project_id', context.projectId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership) {
    return { action_type: action.type, success: false, error: 'User is not a member of this project' };
  }

  const { error } = await supabase
    .from(tableName)
    .update({ owner_id: userId })
    .eq('id', context.entityId)
    .eq('project_id', context.projectId);

  if (error) return { action_type: action.type, success: false, error: error.message };
  return { action_type: action.type, success: true, result: { owner_id: userId } };
}

async function executeSendNotification(
  action: AutomationAction,
  context: ActionContext
): Promise<ActionResult> {
  const supabase = createAdminClient();
  const config = action.config;
  const userIds = Array.isArray(config.user_ids) ? config.user_ids : config.user_id ? [config.user_id] : [];
  const message = String(config.message || `Automation "${context.automationName}" triggered`);

  if (userIds.length === 0) {
    return { action_type: action.type, success: false, error: 'No user_id(s) specified' };
  }

  const notifications = userIds.map((uid: unknown) => ({
    project_id: context.projectId,
    user_id: String(uid),
    type: 'automation' as const,
    title: context.automationName,
    message,
    action_url: `/${context.entityType}s/${context.entityId}`,
    priority: 'normal',
  }));

  const { error } = await supabase.from('notifications').insert(notifications);

  if (error) return { action_type: action.type, success: false, error: error.message };
  return { action_type: action.type, success: true, result: { notified_users: userIds.length } };
}

async function executeSendEmail(
  action: AutomationAction,
  context: ActionContext
): Promise<ActionResult> {
  // Email sending requires Gmail connection and is complex — queue as a draft
  const supabase = createAdminClient();
  const config = action.config;
  const templateId = String(config.template_id || '');

  if (!templateId) return { action_type: action.type, success: false, error: 'No template_id specified' };

  // Fetch template
  const { data: template, error: templateError } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', templateId)
    .eq('project_id', context.projectId)
    .single();

  if (templateError || !template) {
    return { action_type: action.type, success: false, error: 'Template not found' };
  }

  // Get person email from the entity or linked person
  let personEmail: string | null = null;
  if (context.entityType === 'person') {
    personEmail = String(context.data.email || '');
  } else if (context.data.primary_contact_id) {
    const { data: person } = await supabase
      .from('people')
      .select('email')
      .eq('id', String(context.data.primary_contact_id))
      .eq('project_id', context.projectId)
      .single();
    personEmail = person?.email || null;
  }

  if (!personEmail) {
    return { action_type: action.type, success: false, error: 'No recipient email found' };
  }

  // Create an email draft for manual sending (avoids needing Gmail auth in background)
  const { data: draft, error: draftError } = await supabase
    .from('email_drafts')
    .insert({
      project_id: context.projectId,
      template_id: templateId,
      to_email: personEmail,
      subject: template.subject,
      body_html: template.body_html,
      body_text: template.body_text,
      status: 'draft',
      metadata: {
        automation_id: context.automationId,
        automation_name: context.automationName,
        entity_type: context.entityType,
        entity_id: context.entityId,
      },
    })
    .select('id')
    .single();

  if (draftError) return { action_type: action.type, success: false, error: draftError.message };
  return { action_type: action.type, success: true, result: { draft_id: draft.id, to: personEmail } };
}

async function executeEnrollInSequence(
  action: AutomationAction,
  context: ActionContext
): Promise<ActionResult> {
  const supabase = createAdminClient();
  const sequenceId = String(action.config.sequence_id || '');
  if (!sequenceId) return { action_type: action.type, success: false, error: 'No sequence_id specified' };

  // Only people can be enrolled in sequences
  if (context.entityType !== 'person') {
    return { action_type: action.type, success: false, error: 'Only people can be enrolled in sequences' };
  }

  // Validate sequence belongs to this project
  const { data: sequence } = await supabase
    .from('sequences')
    .select('id')
    .eq('id', sequenceId)
    .eq('project_id', context.projectId)
    .maybeSingle();

  if (!sequence) {
    return { action_type: action.type, success: false, error: 'Sequence not found in this project' };
  }

  // Check if already enrolled
  const { data: existing } = await supabase
    .from('sequence_enrollments')
    .select('id')
    .eq('sequence_id', sequenceId)
    .eq('person_id', context.entityId)
    .in('status', ['active', 'paused'])
    .maybeSingle();

  if (existing) {
    return { action_type: action.type, success: true, result: { already_enrolled: true } };
  }

  // Find a Gmail connection for the project
  const { data: gmailConnection } = await supabase
    .from('gmail_connections')
    .select('id')
    .eq('project_id', context.projectId)
    .eq('status', 'connected')
    .limit(1)
    .single();

  if (!gmailConnection) {
    return { action_type: action.type, success: false, error: 'No active Gmail connection found' };
  }

  const { data: enrollment, error } = await supabase
    .from('sequence_enrollments')
    .insert({
      sequence_id: sequenceId,
      person_id: context.entityId,
      gmail_connection_id: gmailConnection.id,
      status: 'active',
      current_step: 1,
      next_send_at: new Date().toISOString(),
      created_by: context.data.owner_id || context.data.created_by || null,
    })
    .select('id')
    .single();

  if (error) return { action_type: action.type, success: false, error: error.message };
  return { action_type: action.type, success: true, result: { enrollment_id: enrollment.id } };
}

async function executeAddTag(
  action: AutomationAction,
  context: ActionContext
): Promise<ActionResult> {
  const supabase = createAdminClient();
  const tagId = String(action.config.tag_id || '');
  if (!tagId) return { action_type: action.type, success: false, error: 'No tag_id specified' };

  const { data: tag } = await supabase
    .from('tags')
    .select('id')
    .eq('id', tagId)
    .eq('project_id', context.projectId)
    .maybeSingle();

  if (!tag) {
    return { action_type: action.type, success: false, error: 'Tag not found in this project' };
  }

  const { error } = await supabase
    .from('entity_tags')
    .upsert({
      tag_id: tagId,
      entity_type: context.entityType,
      entity_id: context.entityId,
    }, { onConflict: 'tag_id,entity_type,entity_id' });

  if (error) return { action_type: action.type, success: false, error: error.message };
  return { action_type: action.type, success: true, result: { tag_id: tagId } };
}

async function executeRemoveTag(
  action: AutomationAction,
  context: ActionContext
): Promise<ActionResult> {
  const supabase = createAdminClient();
  const tagId = String(action.config.tag_id || '');
  if (!tagId) return { action_type: action.type, success: false, error: 'No tag_id specified' };

  const { data: tag } = await supabase
    .from('tags')
    .select('id')
    .eq('id', tagId)
    .eq('project_id', context.projectId)
    .maybeSingle();

  if (!tag) {
    return { action_type: action.type, success: false, error: 'Tag not found in this project' };
  }

  const { error } = await supabase
    .from('entity_tags')
    .delete()
    .eq('tag_id', tagId)
    .eq('entity_type', context.entityType)
    .eq('entity_id', context.entityId);

  if (error) return { action_type: action.type, success: false, error: error.message };
  return { action_type: action.type, success: true, result: { tag_id: tagId } };
}

async function executeCreateActivity(
  action: AutomationAction,
  context: ActionContext
): Promise<ActionResult> {
  const supabase = createAdminClient();
  const config = action.config;

  // Build entity link fields
  const entityLinks: Record<string, string> = {};
  if (context.entityType === 'person') entityLinks.person_id = context.entityId;
  else if (context.entityType === 'organization') entityLinks.organization_id = context.entityId;
  else if (context.entityType === 'opportunity') entityLinks.opportunity_id = context.entityId;
  else if (context.entityType === 'rfp') entityLinks.rfp_id = context.entityId;

  const { data, error } = await supabase
    .from('activity_log')
    .insert({
      project_id: context.projectId,
      entity_type: context.entityType,
      entity_id: context.entityId,
      action: 'automation',
      activity_type: String(config.type || 'note'),
      subject: String(config.subject || context.automationName),
      notes: config.notes ? String(config.notes) : null,
      ...entityLinks,
      metadata: {
        automation_id: context.automationId,
        automation_name: context.automationName,
      },
    })
    .select('id')
    .single();

  if (error) return { action_type: action.type, success: false, error: error.message };
  return { action_type: action.type, success: true, result: { activity_id: data.id } };
}

async function executeRunAiResearch(
  _action: AutomationAction,
  context: ActionContext
): Promise<ActionResult> {
  const supabase = createAdminClient();

  // Create a research job for the entity
  const { data, error } = await supabase
    .from('research_jobs')
    .insert({
      project_id: context.projectId,
      entity_type: context.entityType,
      entity_id: context.entityId,
      status: 'pending',
      metadata: {
        automation_id: context.automationId,
        automation_name: context.automationName,
      },
    })
    .select('id')
    .single();

  if (error) return { action_type: 'run_ai_research', success: false, error: error.message };
  return { action_type: 'run_ai_research', success: true, result: { research_job_id: data.id } };
}

async function executeFireWebhook(
  action: AutomationAction,
  context: ActionContext
): Promise<ActionResult> {
  const config = action.config;
  const url = String(config.webhook_url || '');
  if (!url) return { action_type: action.type, success: false, error: 'No webhook_url specified' };

  // SSRF protection: validate URL
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) {
      return { action_type: action.type, success: false, error: 'Webhook URL must use HTTP or HTTPS' };
    }
    const hostname = parsed.hostname.toLowerCase();
    const bare = hostname.replace(/^\[|\]$/g, '');
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      bare === '::1' ||
      bare === '::' ||
      bare.startsWith('::ffff:') ||
      bare.startsWith('fe80:') ||
      bare.startsWith('fc00:') ||
      (bare.startsWith('fd') && bare.includes(':')) ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      /^0x/i.test(hostname) ||
      /^0\d/.test(hostname) ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      return { action_type: action.type, success: false, error: 'Webhook URL cannot target private/internal addresses' };
    }
  } catch {
    return { action_type: action.type, success: false, error: 'Invalid webhook URL' };
  }

  const payload = {
    ...(config.payload_template ? config.payload_template as Record<string, unknown> : {}),
    automation_id: context.automationId,
    automation_name: context.automationName,
    entity_type: context.entityType,
    entity_id: context.entityId,
    data: context.data,
    timestamp: new Date().toISOString(),
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    return {
      action_type: action.type,
      success: response.ok,
      result: { status: response.status, url },
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      action_type: action.type,
      success: false,
      error: error instanceof Error ? error.message : 'Webhook request failed',
    };
  }
}

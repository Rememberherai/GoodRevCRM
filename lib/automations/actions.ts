import { createClient } from '@supabase/supabase-js';
import type { AutomationAction, AutomationEntityType, TriggerType } from '@/types/automation';
import { sendOutboundSms } from '@/lib/telnyx/sms-service';
import { assertSafeUrl } from '@/lib/workflows/ssrf-guard';

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
  household: 'households',
  case: 'household_cases',
  incident: 'incidents',
  opportunity: 'opportunities',
  rfp: 'rfps',
  product: 'products',
  quote: 'quotes',
  task: 'tasks',
  meeting: 'meetings',
  call: 'calls',
  workflow: 'workflows',
  document: 'contract_documents',
  invoice: 'invoices',
  bill: 'bills',
  payment: 'payments',
  event_type: 'event_types',
  booking: 'bookings',
  disposition: 'dispositions',
  program: 'programs',
  program_enrollment: 'program_enrollments',
  program_attendance: 'program_attendance',
  contribution: 'contributions',
  community_asset: 'community_assets',
  referral: 'referrals',
  relationship: 'relationships',
  broadcast: 'broadcasts',
  intake: 'household_intake',
  household_member: 'household_members',
  job: 'jobs',
  contractor_scope: 'contractor_scopes',
  receipt_confirmation: 'receipt_confirmations',
  grant: 'grants',
  service_type: 'service_types',
  event: 'events',
  event_registration: 'event_registrations',
  event_ticket_type: 'event_ticket_types',
  event_series: 'event_series',
  event_series_registration: 'event_series_registrations',
  asset_access_booking: 'bookings',
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
      case 'send_sms':
        return await executeSendSms(action, context);
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
      case 'run_workflow':
        return await executeRunWorkflow(action, context);
      // ── Community actions ──
      case 'enroll_in_program':
        return await executeEnrollInProgram(action, context);
      case 'update_enrollment_status':
        return await executeUpdateEnrollmentStatus(action, context);
      case 'record_attendance':
        return await executeRecordAttendance(action, context);
      case 'create_contribution':
        return await executeCreateContribution(action, context);
      case 'assign_job':
        return await executeAssignJob(action, context);
      case 'update_job_status':
        return await executeUpdateJobStatus(action, context);
      case 'create_referral':
        return await executeCreateReferral(action, context);
      case 'update_referral_status':
        return await executeUpdateReferralStatus(action, context);
      case 'send_broadcast':
        return await executeSendBroadcast(action, context);
      case 'update_grant_status':
        return await executeUpdateGrantStatus(action, context);
      case 'flag_household_risk':
        return await executeFlagHouseholdRisk(action, context);
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
  else if (context.entityType === 'grant') entityLinks.grant_id = context.entityId;
  else if (
    (context.entityType === 'household' || context.entityType === 'event_registration' || context.entityType === 'asset_access_booking') &&
    typeof context.data.person_id === 'string'
  ) entityLinks.person_id = context.data.person_id;
  else if (context.entityType === 'household' && typeof context.data.primary_contact_id === 'string') entityLinks.person_id = context.data.primary_contact_id;

  const createdBy = await resolveAutomationActorUserId(supabase, context);
  if (!createdBy) {
    return { action_type: action.type, success: false, error: 'Could not resolve created_by user for task' };
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      project_id: context.projectId,
      title: interpolateContextString(config.title || `Auto-task: ${context.automationName}`, context.data) || `Auto-task: ${context.automationName}`,
      description: interpolateContextString(config.description, context.data),
      priority: String(config.priority || 'medium'),
      status: 'pending',
      due_date: dueDate,
      assigned_to: config.assign_to ? String(config.assign_to) : null,
      created_by: createdBy,
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

  // Strict field name validation to prevent injection
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(fieldName)) {
    return { action_type: action.type, success: false, error: 'Invalid field name' };
  }

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
    contract_documents: ['title', 'description', 'status', 'reminder_enabled', 'reminder_interval_days'],
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
  let userIds = Array.isArray(config.user_ids) ? config.user_ids : config.user_id ? [config.user_id] : [];
  const message = interpolateContextString(
    config.message || `Automation "${context.automationName}" triggered`,
    context.data,
  ) || `Automation "${context.automationName}" triggered`;

  if (userIds.length === 0) {
    const roles = Array.isArray(config.notify_roles)
      ? config.notify_roles.map(String)
      : config.notify_role
        ? [String(config.notify_role)]
        : [];

    if (roles.length > 0) {
      const { data: memberships, error } = await supabase
        .from('project_memberships')
        .select('user_id')
        .eq('project_id', context.projectId)
        .in('role', roles);

      if (error) return { action_type: action.type, success: false, error: error.message };
      userIds = [...new Set((memberships || []).map((membership) => membership.user_id).filter(Boolean))];
    }
  }

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

async function executeSendSms(
  action: AutomationAction,
  context: ActionContext
): Promise<ActionResult> {
  const supabase = createAdminClient();
  const config = action.config;
  const messageTemplate = String(config.message || '');

  if (!messageTemplate) {
    return { action_type: action.type, success: false, error: 'No message specified' };
  }

  // Only people can receive SMS (need phone number)
  if (context.entityType !== 'person') {
    return { action_type: action.type, success: false, error: 'send_sms only applies to people' };
  }

  // Get person phone number
  const { data: person } = await supabase
    .from('people')
    .select('id, first_name, last_name, email, mobile_phone, phone, organization_id')
    .eq('id', context.entityId)
    .eq('project_id', context.projectId)
    .single();

  if (!person) {
    return { action_type: action.type, success: false, error: 'Person not found' };
  }

  const toNumber = person.mobile_phone || person.phone;
  if (!toNumber) {
    return { action_type: action.type, success: false, error: 'Person has no phone number' };
  }

  // Find Telnyx connection for the project
  const { data: telnyxConnection } = await supabase
    .from('telnyx_connections')
    .select('id, api_key_enc, messaging_profile_id, outbound_phone_number')
    .eq('project_id', context.projectId)
    .eq('status', 'active')
    .limit(1)
    .single();

  if (!telnyxConnection) {
    return { action_type: action.type, success: false, error: 'No active Telnyx connection found' };
  }

  if (!telnyxConnection.messaging_profile_id) {
    return { action_type: action.type, success: false, error: 'Telnyx connection has no messaging profile configured' };
  }

  // Simple variable substitution in message
  let message = messageTemplate
    .replace(/\{\{first_name\}\}/gi, person.first_name || '')
    .replace(/\{\{last_name\}\}/gi, person.last_name || '')
    .replace(/\{\{email\}\}/gi, person.email || '')
    .replace(/\{\{phone\}\}/gi, toNumber);

  // Trim and validate message length
  message = message.trim();
  if (message.length > 1600) {
    message = message.substring(0, 1600);
  }

  try {
    // Use a system user ID for automation-triggered SMS
    // (the created_by field on the entity if available, otherwise null)
    const userId = String(context.data.owner_id || context.data.created_by || '');

    const result = await sendOutboundSms({
      projectId: context.projectId,
      userId,
      toNumber,
      body: message,
      personId: context.entityId,
      organizationId: person.organization_id || undefined,
    });

    return {
      action_type: action.type,
      success: true,
      result: { sms_id: result.smsId, telnyx_message_id: result.telnyxMessageId, to: toNumber },
    };
  } catch (error) {
    return {
      action_type: action.type,
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send SMS',
    };
  }
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
      subject: interpolateContextString(config.subject || context.automationName, context.data) || context.automationName,
      notes: interpolateContextString(config.notes, context.data),
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

  // SSRF protection: validate URL using shared guard
  try {
    assertSafeUrl(url);
  } catch {
    return { action_type: action.type, success: false, error: 'Webhook URL cannot target private/internal addresses' };
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
      redirect: 'manual',
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

async function executeRunWorkflow(
  action: AutomationAction,
  context: ActionContext
): Promise<ActionResult> {
  const supabase = createAdminClient();
  const workflowId = String(action.config.workflow_id || '');
  if (!workflowId) return { action_type: action.type, success: false, error: 'No workflow_id specified' };

  // Load the workflow
  const { data: workflow, error: wfError } = await supabase
    .from('workflows')
    .select('id, current_version, definition, is_active')
    .eq('id', workflowId)
    .eq('project_id', context.projectId)
    .single();

  if (wfError || !workflow) {
    return { action_type: action.type, success: false, error: `Workflow not found: ${wfError?.message || 'not found'}` };
  }

  if (!workflow.is_active) {
    return { action_type: action.type, success: false, error: 'Workflow is not active' };
  }

  // Use RPC for atomic execution creation + count increment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: executionId, error: rpcError } = await (supabase as any).rpc('log_workflow_execution', {
    p_workflow_id: workflow.id,
    p_workflow_version: workflow.current_version,
    p_trigger_event: { type: 'automation', automation_id: context.automationId },
    p_status: 'running',
    p_entity_type: context.entityType || null,
    p_entity_id: context.entityId || null,
  });

  if (rpcError || !executionId) {
    return { action_type: action.type, success: false, error: `Failed to create execution: ${rpcError?.message}` };
  }

  // Set context_data (RPC doesn't accept it)
  const ctxData = { entity_type: context.entityType, entity_id: context.entityId, ...context.data };
  await supabase.from('workflow_executions')
    .update({ context_data: ctxData as unknown as import('@/types/database').Json })
    .eq('id', executionId);

  // Fire and forget the actual workflow execution
  const { executeWorkflow } = await import('@/lib/workflows/engine');
  const definition = workflow.definition as unknown as import('@/types/workflow').WorkflowDefinition;
  executeWorkflow(
    workflow.id,
    executionId,
    context.projectId,
    definition,
    ctxData
  ).catch((err) => console.error('Workflow execution failed:', err));

  return {
    action_type: action.type,
    success: true,
    result: { workflow_id: workflowId, execution_id: executionId },
  };
}

// ── Community action handlers ─────────────────────────────────────────────────

function resolveContextField(fieldPath: string, contextData: Record<string, unknown>): string | null {
  const normalized = fieldPath
    .trim()
    .replace(/^\{\{\s*/, '')
    .replace(/\s*\}\}$/, '')
    .replace(/^context\./, '');
  const parts = normalized.split('.');

  const tryResolve = (candidateParts: string[]) => {
    let cur: unknown = contextData;
    for (const part of candidateParts) {
      if (cur == null || typeof cur !== 'object') return null;
      cur = (cur as Record<string, unknown>)[part];
    }
    return cur != null ? String(cur) : null;
  };

  const direct = tryResolve(parts);
  if (direct != null) return direct;

  if (parts.length > 1) {
    const withoutPrefix = tryResolve(parts.slice(1));
    if (withoutPrefix != null) return withoutPrefix;

    const snakeCaseKey = parts.join('_');
    if (snakeCaseKey in contextData && contextData[snakeCaseKey] != null) {
      return String(contextData[snakeCaseKey]);
    }
  }

  return null;
}

function resolveStringOrContext(
  value: unknown,
  contextData: Record<string, unknown>,
): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') return String(value);

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('{{') || trimmed.startsWith('context.') || trimmed.includes('.')) {
    const resolved = resolveContextField(trimmed, contextData);
    if (resolved != null) return resolved;
  }

  return trimmed;
}

function interpolateContextString(
  value: unknown,
  contextData: Record<string, unknown>,
): string | null {
  if (value == null) return null;

  const template = String(value);
  if (!template) return null;

  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, path: string) => {
    const resolved = resolveContextField(path, contextData);
    return resolved ?? '';
  });
}

async function resolveAutomationActorUserId(
  supabase: ReturnType<typeof createAdminClient>,
  context: ActionContext,
): Promise<string | null> {
  const candidates = [
    context.data.owner_id,
    context.data.created_by,
    context.data.updated_by,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);

  if (candidates.length > 0) {
    const { data: membership } = await supabase
      .from('project_memberships')
      .select('user_id')
      .eq('project_id', context.projectId)
      .in('user_id', candidates)
      .limit(1)
      .maybeSingle();

    if (membership?.user_id) return membership.user_id;
  }

  const { data: elevatedMembership } = await supabase
    .from('project_memberships')
    .select('user_id')
    .eq('project_id', context.projectId)
    .in('role', ['owner', 'admin'])
    .limit(1)
    .maybeSingle();

  if (elevatedMembership?.user_id) return elevatedMembership.user_id;

  const { data: anyMembership } = await supabase
    .from('project_memberships')
    .select('user_id')
    .eq('project_id', context.projectId)
    .limit(1)
    .maybeSingle();

  return anyMembership?.user_id ?? null;
}

function queueAutomationEvent(event: {
  projectId: string;
  triggerType: TriggerType;
  entityType: AutomationEntityType;
  entityId: string;
  data: Record<string, unknown>;
}) {
  import('@/lib/automations/engine')
    .then(({ emitAutomationEvent }) => emitAutomationEvent(event))
    .catch(console.error);
}

async function executeEnrollInProgram(
  action: AutomationAction,
  context: ActionContext,
): Promise<ActionResult> {
  const supabase = createAdminClient();
  const config = action.config;

  const programId = resolveStringOrContext(config.program_id, context.data) || '';
  if (!programId) return { action_type: action.type, success: false, error: 'No program_id specified' };

  const personId = config.person_id_field
    ? resolveContextField(String(config.person_id_field), context.data) ?? String(context.data.person_id || '')
    : String(context.data.person_id || context.data.primary_contact_id || '');

  const householdId = config.household_id_field
    ? resolveContextField(String(config.household_id_field), context.data) ?? String(context.data.household_id || '')
    : String(context.data.household_id || '');

  const status = String(config.status || 'active');

  // Prevent duplicate active enrollments (only check when personId is known)
  const { data: existing } = personId ? await supabase
    .from('program_enrollments')
    .select('id')
    .eq('program_id', programId)
    .eq('person_id', personId)
    .in('status', ['active', 'waitlisted'])
    .maybeSingle() : { data: null };

  if (existing) {
    return { action_type: action.type, success: true, result: { already_enrolled: true, enrollment_id: existing.id } };
  }

  if (!personId && !householdId) {
    return { action_type: action.type, success: false, error: 'No person_id or household_id resolved — enrollment requires at least one' };
  }

  const { data, error } = await supabase
    .from('program_enrollments')
    .insert({
      program_id: programId,
      person_id: personId || null,
      household_id: householdId || null,
      status,
      enrolled_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) return { action_type: action.type, success: false, error: error.message };
  queueAutomationEvent({
    projectId: context.projectId,
    triggerType: 'program.enrollment.created',
    entityType: 'program_enrollment',
    entityId: data.id,
    data: {
      id: data.id,
      program_id: programId,
      person_id: personId || null,
      household_id: householdId || null,
      status,
      enrolled_at: new Date().toISOString(),
    },
  });
  return { action_type: action.type, success: true, result: { enrollment_id: data.id } };
}

async function executeUpdateEnrollmentStatus(
  action: AutomationAction,
  context: ActionContext,
): Promise<ActionResult> {
  const supabase = createAdminClient();
  const config = action.config;

  const enrollmentId = config.enrollment_id_field
    ? resolveContextField(String(config.enrollment_id_field), context.data) ?? String(context.data.enrollment_id || '')
    : String(context.data.enrollment_id || context.entityId);

  if (!enrollmentId) return { action_type: action.type, success: false, error: 'No enrollment_id resolved' };

  const status = String(config.status || 'active');

  const { error } = await supabase
    .from('program_enrollments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', enrollmentId);

  if (error) return { action_type: action.type, success: false, error: error.message };
  queueAutomationEvent({
    projectId: context.projectId,
    triggerType: 'entity.updated',
    entityType: 'program_enrollment',
    entityId: enrollmentId,
    data: { id: enrollmentId, status },
  });
  return { action_type: action.type, success: true, result: { enrollment_id: enrollmentId, status } };
}

async function executeRecordAttendance(
  action: AutomationAction,
  context: ActionContext,
): Promise<ActionResult> {
  const supabase = createAdminClient();
  const config = action.config;

  const programId = config.program_id_field
    ? resolveContextField(String(config.program_id_field), context.data) ?? String(context.data.program_id || '')
    : String(context.data.program_id || '');

  if (!programId) return { action_type: action.type, success: false, error: 'No program_id resolved' };

  const personId = config.person_id_field
    ? resolveContextField(String(config.person_id_field), context.data) ?? String(context.data.person_id || '')
    : String(context.data.person_id || '');

  if (!personId) return { action_type: action.type, success: false, error: 'No person_id resolved' };

  const attendanceStatus = String(config.status || 'present');
  const date = resolveStringOrContext(config.date, context.data) || new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('program_attendance')
    .upsert({
      program_id: programId,
      person_id: personId,
      date,
      status: attendanceStatus,
      hours: config.hours != null ? Number(config.hours) : 0,
    }, { onConflict: 'program_id,person_id,date' })
    .select('id')
    .single();

  if (error) return { action_type: action.type, success: false, error: error.message };
  queueAutomationEvent({
    projectId: context.projectId,
    triggerType: 'program.attendance.batch',
    entityType: 'program_attendance',
    entityId: data.id,
    data: {
      id: data.id,
      program_id: programId,
      person_id: personId,
      date,
      status: attendanceStatus,
    },
  });
  return { action_type: action.type, success: true, result: { attendance_id: data.id, date, status: attendanceStatus } };
}

async function executeCreateContribution(
  action: AutomationAction,
  context: ActionContext,
): Promise<ActionResult> {
  const supabase = createAdminClient();
  const config = action.config;

  const householdId = config.household_id_field
    ? resolveContextField(String(config.household_id_field), context.data) ?? String(context.data.household_id || '')
    : String(context.data.household_id || '');

  if (!householdId) return { action_type: action.type, success: false, error: 'No household_id resolved' };

  const contributionType = String(config.type || 'monetary');
  const resolvedValue = resolveStringOrContext(config.value, context.data);
  const resolvedHours = resolveStringOrContext(config.hours, context.data);
  const value = resolvedValue != null ? Number(resolvedValue) : null;
  const hours = resolvedHours != null ? Number(resolvedHours) : null;

  const { data, error } = await supabase
    .from('contributions')
    .insert({
      project_id: context.projectId,
      recipient_household_id: householdId,
      type: contributionType,
      value: value ?? undefined,
      hours: hours ?? undefined,
      date: new Date().toISOString().split('T')[0],
      status: 'received',
      description: `Automated by workflow: ${context.automationName ?? context.automationId}`,
    })
    .select('id')
    .single();

  if (error) return { action_type: action.type, success: false, error: error.message };
  queueAutomationEvent({
    projectId: context.projectId,
    triggerType: 'contribution.created',
    entityType: 'contribution',
    entityId: data.id,
    data: {
      id: data.id,
      recipient_household_id: householdId,
      type: contributionType,
      value,
      hours,
    },
  });
  return { action_type: action.type, success: true, result: { contribution_id: data.id } };
}

async function executeAssignJob(
  action: AutomationAction,
  context: ActionContext,
): Promise<ActionResult> {
  const supabase = createAdminClient();
  const config = action.config;

  const jobId = config.job_id_field
    ? resolveContextField(String(config.job_id_field), context.data) ?? String(context.data.job_id || '')
    : String(context.data.job_id || context.entityId);

  if (!jobId) return { action_type: action.type, success: false, error: 'No job_id resolved' };

  const contractorId = config.contractor_id_field
    ? resolveContextField(String(config.contractor_id_field), context.data) ?? String(context.data.contractor_id || '')
    : String(context.data.contractor_id || '');

  if (!contractorId) return { action_type: action.type, success: false, error: 'No contractor_id resolved' };

  const { error } = await supabase
    .from('jobs')
    .update({
      contractor_id: contractorId,
      status: 'assigned',
    })
    .eq('id', jobId)
    .eq('project_id', context.projectId);

  if (error) return { action_type: action.type, success: false, error: error.message };
  queueAutomationEvent({
    projectId: context.projectId,
    triggerType: 'job.assigned',
    entityType: 'job',
    entityId: jobId,
    data: { id: jobId, contractor_id: contractorId, status: 'assigned' },
  });
  return { action_type: action.type, success: true, result: { job_id: jobId, contractor_id: contractorId } };
}

async function executeUpdateJobStatus(
  action: AutomationAction,
  context: ActionContext,
): Promise<ActionResult> {
  const supabase = createAdminClient();
  const config = action.config;

  const jobId = config.job_id_field
    ? resolveContextField(String(config.job_id_field), context.data) ?? String(context.data.job_id || '')
    : String(context.data.job_id || context.entityId);

  if (!jobId) return { action_type: action.type, success: false, error: 'No job_id resolved' };

  const status = String(config.status || 'in_progress');
  const updates: Record<string, unknown> = { status };
  if (status === 'completed') updates.completed_at = new Date().toISOString();

  const { error } = await supabase
    .from('jobs')
    .update(updates)
    .eq('id', jobId)
    .eq('project_id', context.projectId);

  if (error) return { action_type: action.type, success: false, error: error.message };
  queueAutomationEvent({
    projectId: context.projectId,
    triggerType: status === 'completed' ? 'job.completed' : 'entity.updated',
    entityType: 'job',
    entityId: jobId,
    data: { id: jobId, status, ...updates },
  });
  return { action_type: action.type, success: true, result: { job_id: jobId, status } };
}

async function executeCreateReferral(
  action: AutomationAction,
  context: ActionContext,
): Promise<ActionResult> {
  const supabase = createAdminClient();
  const config = action.config;

  const householdId = config.household_id_field
    ? resolveContextField(String(config.household_id_field), context.data) ?? String(context.data.household_id || '')
    : String(context.data.household_id || '');

  if (!householdId) return { action_type: action.type, success: false, error: 'No household_id resolved' };

  const serviceType = String(config.service_type || '');
  if (!serviceType) return { action_type: action.type, success: false, error: 'No service_type specified' };

  const { data, error } = await supabase
    .from('referrals')
    .insert({
      project_id: context.projectId,
      household_id: householdId,
      service_type: serviceType,
      status: 'submitted',
      notes: config.notes
        ? String(config.notes)
        : `Automated by workflow: ${context.automationName ?? context.automationId}`,
    })
    .select('id')
    .single();

  if (error) return { action_type: action.type, success: false, error: error.message };
  queueAutomationEvent({
    projectId: context.projectId,
    triggerType: 'referral.created',
    entityType: 'referral',
    entityId: data.id,
    data: {
      id: data.id,
      household_id: householdId,
      service_type: serviceType,
      status: 'submitted',
    },
  });
  return { action_type: action.type, success: true, result: { referral_id: data.id } };
}

async function executeUpdateReferralStatus(
  action: AutomationAction,
  context: ActionContext,
): Promise<ActionResult> {
  const supabase = createAdminClient();
  const config = action.config;

  const referralId = config.referral_id_field
    ? resolveContextField(String(config.referral_id_field), context.data) ?? String(context.data.referral_id || '')
    : String(context.data.referral_id || context.entityId);

  if (!referralId) return { action_type: action.type, success: false, error: 'No referral_id resolved' };

  const status = String(config.status || 'in_progress');
  const updates: Record<string, unknown> = { status };
  if (config.outcome) updates.outcome = String(config.outcome);

  const { error } = await supabase
    .from('referrals')
    .update(updates)
    .eq('id', referralId)
    .eq('project_id', context.projectId);

  if (error) return { action_type: action.type, success: false, error: error.message };
  queueAutomationEvent({
    projectId: context.projectId,
    triggerType: status === 'completed' ? 'referral.completed' : 'entity.updated',
    entityType: 'referral',
    entityId: referralId,
    data: { id: referralId, status, ...updates },
  });
  return { action_type: action.type, success: true, result: { referral_id: referralId, status } };
}

async function executeSendBroadcast(
  action: AutomationAction,
  context: ActionContext,
): Promise<ActionResult> {
  const supabase = createAdminClient();
  const config = action.config;

  const subject = interpolateContextString(config.subject || `Broadcast: ${context.automationName}`, context.data) || `Broadcast: ${context.automationName}`;
  const body = interpolateContextString(config.body, context.data) || '';
  const channel = String(config.channel || 'email');

  if (!body) return { action_type: action.type, success: false, error: 'No body specified' };

  // Create a draft broadcast — actual sending requires explicit review
  const { data, error } = await supabase
    .from('broadcasts')
    .insert({
      project_id: context.projectId,
      subject,
      body,
      channel,
      status: 'draft',
      filter_criteria: {
        automation_id: context.automationId,
        automation_name: context.automationName,
        entity_type: context.entityType,
        entity_id: context.entityId,
      },
    })
    .select('id')
    .single();

  if (error) return { action_type: action.type, success: false, error: error.message };
  return { action_type: action.type, success: true, result: { broadcast_id: data.id, channel } };
}

async function executeUpdateGrantStatus(
  action: AutomationAction,
  context: ActionContext,
): Promise<ActionResult> {
  const supabase = createAdminClient();
  const config = action.config;

  const grantId = config.grant_id_field
    ? resolveContextField(String(config.grant_id_field), context.data) ?? String(context.data.grant_id || '')
    : String(context.data.grant_id || context.entityId);

  if (!grantId) return { action_type: action.type, success: false, error: 'No grant_id resolved' };

  const status = String(config.status || '');
  if (!status) return { action_type: action.type, success: false, error: 'No status specified' };

  const { error } = await supabase
    .from('grants')
    .update({ status })
    .eq('id', grantId)
    .eq('project_id', context.projectId);

  if (error) return { action_type: action.type, success: false, error: error.message };
  queueAutomationEvent({
    projectId: context.projectId,
    triggerType: 'grant.status_changed',
    entityType: 'grant',
    entityId: grantId,
    data: { id: grantId, status },
  });
  return { action_type: action.type, success: true, result: { grant_id: grantId, status } };
}

async function executeFlagHouseholdRisk(
  action: AutomationAction,
  context: ActionContext,
): Promise<ActionResult> {
  const supabase = createAdminClient();
  const config = action.config;

  const householdId = config.household_id_field
    ? resolveContextField(String(config.household_id_field), context.data) ?? String(context.data.household_id || '')
    : String(context.data.household_id || context.entityId);

  if (!householdId) return { action_type: action.type, success: false, error: 'No household_id resolved' };

  const riskLevel = String(config.risk_level || 'high');
  const reason = config.reason ? String(config.reason) : null;

  // Fetch current custom_fields to merge into
  const { data: current, error: fetchError } = await supabase
    .from('households')
    .select('custom_fields')
    .eq('id', householdId)
    .eq('project_id', context.projectId)
    .single();

  if (fetchError || !current) return { action_type: action.type, success: false, error: fetchError?.message ?? 'Household not found' };

  const existingCustomFields = (current.custom_fields as Record<string, unknown>) ?? {};
  const updatedCustomFields: Record<string, unknown> = {
    ...existingCustomFields,
    risk_level: riskLevel,
    risk_flagged_at: new Date().toISOString(),
    risk_flagged_by: `automation:${context.automationId}`,
  };
  if (reason) updatedCustomFields.risk_reason = reason;

  const { error } = await supabase
    .from('households')
    .update({ custom_fields: updatedCustomFields })
    .eq('id', householdId)
    .eq('project_id', context.projectId);

  if (error) return { action_type: action.type, success: false, error: error.message };
  queueAutomationEvent({
    projectId: context.projectId,
    triggerType: riskLevel === 'high' ? 'risk_score.high' : 'entity.updated',
    entityType: 'household',
    entityId: householdId,
    data: {
      id: householdId,
      custom_fields: updatedCustomFields,
      risk_level: riskLevel,
      risk_reason: reason,
    },
  });
  return { action_type: action.type, success: true, result: { household_id: householdId, risk_level: riskLevel } };
}

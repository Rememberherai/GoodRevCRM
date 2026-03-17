import type { ReportableObject, ReportableField, ReportSchema } from './types';
import { createAdminClient } from '@/lib/supabase/admin';

// ── Static Schema Definitions ───────────────────────────────────────────────

const REPORTABLE_OBJECTS: Record<string, ReportableObject> = {
  organizations: {
    name: 'organizations',
    label: 'Organization',
    labelPlural: 'Organizations',
    softDelete: true,
    projectScoped: true,
    fields: [
      { name: 'id', label: 'ID', type: 'uuid', aggregatable: false, groupable: false, filterable: true },
      { name: 'name', label: 'Name', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'domain', label: 'Domain', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'website', label: 'Website', type: 'text', aggregatable: false, groupable: false, filterable: true },
      { name: 'industry', label: 'Industry', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'employee_count', label: 'Employee Count', type: 'number', aggregatable: true, groupable: true, filterable: true },
      { name: 'annual_revenue', label: 'Annual Revenue', type: 'currency', aggregatable: true, groupable: false, filterable: true },
      { name: 'phone', label: 'Phone', type: 'text', aggregatable: false, groupable: false, filterable: true },
      { name: 'address_city', label: 'City', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'address_state', label: 'State', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'address_country', label: 'Country', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'linkedin_url', label: 'LinkedIn', type: 'text', aggregatable: false, groupable: false, filterable: false },
      { name: 'created_at', label: 'Created At', type: 'datetime', aggregatable: false, groupable: true, filterable: true },
      { name: 'updated_at', label: 'Updated At', type: 'datetime', aggregatable: false, groupable: false, filterable: true },
    ],
    relations: [
      { name: 'opportunities', label: 'Opportunities', targetObject: 'opportunities', type: 'has_many', foreignKey: 'organization_id', targetKey: 'id' },
      { name: 'rfps', label: 'RFPs', targetObject: 'rfps', type: 'has_many', foreignKey: 'organization_id', targetKey: 'id' },
    ],
  },

  people: {
    name: 'people',
    label: 'Person',
    labelPlural: 'People',
    softDelete: true,
    projectScoped: true,
    fields: [
      { name: 'id', label: 'ID', type: 'uuid', aggregatable: false, groupable: false, filterable: true },
      { name: 'first_name', label: 'First Name', type: 'text', aggregatable: false, groupable: false, filterable: true },
      { name: 'last_name', label: 'Last Name', type: 'text', aggregatable: false, groupable: false, filterable: true },
      { name: 'email', label: 'Email', type: 'text', aggregatable: false, groupable: false, filterable: true },
      { name: 'phone', label: 'Phone', type: 'text', aggregatable: false, groupable: false, filterable: true },
      { name: 'mobile_phone', label: 'Mobile Phone', type: 'text', aggregatable: false, groupable: false, filterable: true },
      { name: 'job_title', label: 'Job Title', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'department', label: 'Department', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'address_city', label: 'City', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'address_state', label: 'State', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'address_country', label: 'Country', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'timezone', label: 'Timezone', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'linkedin_url', label: 'LinkedIn', type: 'text', aggregatable: false, groupable: false, filterable: false },
      { name: 'preferred_contact_method', label: 'Preferred Contact', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'enrichment_status', label: 'Enrichment Status', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'email_verified', label: 'Email Verified', type: 'boolean', aggregatable: false, groupable: true, filterable: true },
      { name: 'created_at', label: 'Created At', type: 'datetime', aggregatable: false, groupable: true, filterable: true },
      { name: 'updated_at', label: 'Updated At', type: 'datetime', aggregatable: false, groupable: false, filterable: true },
    ],
    relations: [],
  },

  opportunities: {
    name: 'opportunities',
    label: 'Opportunity',
    labelPlural: 'Opportunities',
    softDelete: true,
    projectScoped: true,
    fields: [
      { name: 'id', label: 'ID', type: 'uuid', aggregatable: false, groupable: false, filterable: true },
      { name: 'name', label: 'Name', type: 'text', aggregatable: false, groupable: false, filterable: true },
      { name: 'amount', label: 'Amount', type: 'currency', aggregatable: true, groupable: false, filterable: true },
      { name: 'currency', label: 'Currency', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'probability', label: 'Probability', type: 'percentage', aggregatable: true, groupable: false, filterable: true },
      { name: 'stage', label: 'Stage', type: 'enum', aggregatable: false, groupable: true, filterable: true, enumValues: ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] },
      { name: 'expected_close_date', label: 'Expected Close Date', type: 'date', aggregatable: false, groupable: true, filterable: true },
      { name: 'actual_close_date', label: 'Actual Close Date', type: 'date', aggregatable: false, groupable: true, filterable: true },
      { name: 'won_reason', label: 'Won Reason', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'lost_reason', label: 'Lost Reason', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'competitor', label: 'Competitor', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'source', label: 'Source', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'campaign', label: 'Campaign', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'days_in_stage', label: 'Days in Stage', type: 'number', aggregatable: true, groupable: false, filterable: true },
      { name: 'organization_id', label: 'Organization ID', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'primary_contact_id', label: 'Primary Contact ID', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'owner_id', label: 'Owner ID', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'stage_changed_at', label: 'Stage Changed At', type: 'datetime', aggregatable: false, groupable: false, filterable: true },
      { name: 'created_at', label: 'Created At', type: 'datetime', aggregatable: false, groupable: true, filterable: true },
      { name: 'updated_at', label: 'Updated At', type: 'datetime', aggregatable: false, groupable: false, filterable: true },
    ],
    relations: [
      { name: 'organization', label: 'Organization', targetObject: 'organizations', type: 'belongs_to', foreignKey: 'organization_id', targetKey: 'id' },
      { name: 'primary_contact', label: 'Primary Contact', targetObject: 'people', type: 'belongs_to', foreignKey: 'primary_contact_id', targetKey: 'id' },
    ],
  },

  rfps: {
    name: 'rfps',
    label: 'RFP',
    labelPlural: 'RFPs',
    softDelete: true,
    projectScoped: true,
    fields: [
      { name: 'id', label: 'ID', type: 'uuid', aggregatable: false, groupable: false, filterable: true },
      { name: 'title', label: 'Title', type: 'text', aggregatable: false, groupable: false, filterable: true },
      { name: 'rfp_number', label: 'RFP Number', type: 'text', aggregatable: false, groupable: false, filterable: true },
      { name: 'status', label: 'Status', type: 'enum', aggregatable: false, groupable: true, filterable: true, enumValues: ['identified', 'reviewing', 'preparing', 'submitted', 'won', 'lost', 'no_bid'] },
      { name: 'estimated_value', label: 'Estimated Value', type: 'currency', aggregatable: true, groupable: false, filterable: true },
      { name: 'currency', label: 'Currency', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'due_date', label: 'Due Date', type: 'date', aggregatable: false, groupable: true, filterable: true },
      { name: 'issue_date', label: 'Issue Date', type: 'date', aggregatable: false, groupable: true, filterable: true },
      { name: 'decision_date', label: 'Decision Date', type: 'date', aggregatable: false, groupable: true, filterable: true },
      { name: 'win_probability', label: 'Win Probability', type: 'percentage', aggregatable: true, groupable: false, filterable: true },
      { name: 'go_no_go_decision', label: 'Go/No-Go Decision', type: 'boolean', aggregatable: false, groupable: true, filterable: true },
      { name: 'submission_method', label: 'Submission Method', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'organization_id', label: 'Organization ID', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'opportunity_id', label: 'Opportunity ID', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'owner_id', label: 'Owner ID', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'created_at', label: 'Created At', type: 'datetime', aggregatable: false, groupable: true, filterable: true },
      { name: 'updated_at', label: 'Updated At', type: 'datetime', aggregatable: false, groupable: false, filterable: true },
    ],
    relations: [
      { name: 'organization', label: 'Organization', targetObject: 'organizations', type: 'belongs_to', foreignKey: 'organization_id', targetKey: 'id' },
      { name: 'opportunity', label: 'Opportunity', targetObject: 'opportunities', type: 'belongs_to', foreignKey: 'opportunity_id', targetKey: 'id' },
    ],
  },

  activity_log: {
    name: 'activity_log',
    label: 'Activity',
    labelPlural: 'Activities',
    softDelete: false,
    projectScoped: true,
    fields: [
      { name: 'id', label: 'ID', type: 'uuid', aggregatable: false, groupable: false, filterable: true },
      { name: 'entity_type', label: 'Entity Type', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'entity_id', label: 'Entity ID', type: 'uuid', aggregatable: false, groupable: false, filterable: true },
      { name: 'action', label: 'Action', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'activity_type', label: 'Activity Type', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'subject', label: 'Subject', type: 'text', aggregatable: false, groupable: false, filterable: true },
      { name: 'outcome', label: 'Outcome', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'direction', label: 'Direction', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'duration_minutes', label: 'Duration (min)', type: 'number', aggregatable: true, groupable: false, filterable: true },
      { name: 'notes', label: 'Notes', type: 'text', aggregatable: false, groupable: false, filterable: true },
      { name: 'follow_up_date', label: 'Follow-up Date', type: 'date', aggregatable: false, groupable: true, filterable: true },
      { name: 'user_id', label: 'User ID', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'person_id', label: 'Person ID', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'organization_id', label: 'Organization ID', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'opportunity_id', label: 'Opportunity ID', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'rfp_id', label: 'RFP ID', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'created_at', label: 'Created At', type: 'datetime', aggregatable: false, groupable: true, filterable: true },
    ],
    relations: [
      { name: 'organization', label: 'Organization', targetObject: 'organizations', type: 'belongs_to', foreignKey: 'organization_id', targetKey: 'id' },
      { name: 'person', label: 'Person', targetObject: 'people', type: 'belongs_to', foreignKey: 'person_id', targetKey: 'id' },
      { name: 'opportunity', label: 'Opportunity', targetObject: 'opportunities', type: 'belongs_to', foreignKey: 'opportunity_id', targetKey: 'id' },
    ],
  },

  tasks: {
    name: 'tasks',
    label: 'Task',
    labelPlural: 'Tasks',
    softDelete: false,
    projectScoped: true,
    fields: [
      { name: 'id', label: 'ID', type: 'uuid', aggregatable: false, groupable: false, filterable: true },
      { name: 'title', label: 'Title', type: 'text', aggregatable: false, groupable: false, filterable: true },
      { name: 'status', label: 'Status', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'priority', label: 'Priority', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'due_date', label: 'Due Date', type: 'date', aggregatable: false, groupable: true, filterable: true },
      { name: 'completed_at', label: 'Completed At', type: 'datetime', aggregatable: false, groupable: true, filterable: true },
      { name: 'assigned_to', label: 'Assigned To', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'created_by', label: 'Created By', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'person_id', label: 'Person ID', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'organization_id', label: 'Organization ID', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'opportunity_id', label: 'Opportunity ID', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'rfp_id', label: 'RFP ID', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'created_at', label: 'Created At', type: 'datetime', aggregatable: false, groupable: true, filterable: true },
      { name: 'updated_at', label: 'Updated At', type: 'datetime', aggregatable: false, groupable: false, filterable: true },
    ],
    relations: [
      { name: 'organization', label: 'Organization', targetObject: 'organizations', type: 'belongs_to', foreignKey: 'organization_id', targetKey: 'id' },
      { name: 'person', label: 'Person', targetObject: 'people', type: 'belongs_to', foreignKey: 'person_id', targetKey: 'id' },
      { name: 'opportunity', label: 'Opportunity', targetObject: 'opportunities', type: 'belongs_to', foreignKey: 'opportunity_id', targetKey: 'id' },
    ],
  },

  sent_emails: {
    name: 'sent_emails',
    label: 'Sent Email',
    labelPlural: 'Sent Emails',
    softDelete: false,
    projectScoped: true,
    fields: [
      { name: 'id', label: 'ID', type: 'uuid', aggregatable: false, groupable: false, filterable: true },
      { name: 'recipient_email', label: 'Recipient', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'subject', label: 'Subject', type: 'text', aggregatable: false, groupable: false, filterable: true },
      { name: 'person_id', label: 'Person ID', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'organization_id', label: 'Organization ID', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'opportunity_id', label: 'Opportunity ID', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'created_by', label: 'Sent By', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'sent_at', label: 'Sent At', type: 'datetime', aggregatable: false, groupable: true, filterable: true },
    ],
    relations: [
      { name: 'organization', label: 'Organization', targetObject: 'organizations', type: 'belongs_to', foreignKey: 'organization_id', targetKey: 'id' },
      { name: 'person', label: 'Person', targetObject: 'people', type: 'belongs_to', foreignKey: 'person_id', targetKey: 'id' },
      { name: 'opportunity', label: 'Opportunity', targetObject: 'opportunities', type: 'belongs_to', foreignKey: 'opportunity_id', targetKey: 'id' },
    ],
  },

  calls: {
    name: 'calls',
    label: 'Call',
    labelPlural: 'Calls',
    softDelete: false,
    projectScoped: true,
    fields: [
      { name: 'id', label: 'ID', type: 'uuid', aggregatable: false, groupable: false, filterable: true },
      { name: 'status', label: 'Status', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'direction', label: 'Direction', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'duration_seconds', label: 'Duration (sec)', type: 'number', aggregatable: true, groupable: false, filterable: true },
      { name: 'talk_time_seconds', label: 'Talk Time (sec)', type: 'number', aggregatable: true, groupable: false, filterable: true },
      { name: 'disposition', label: 'Disposition', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'from_number', label: 'From Number', type: 'text', aggregatable: false, groupable: false, filterable: true },
      { name: 'to_number', label: 'To Number', type: 'text', aggregatable: false, groupable: false, filterable: true },
      { name: 'person_id', label: 'Person ID', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'organization_id', label: 'Organization ID', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'opportunity_id', label: 'Opportunity ID', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'user_id', label: 'User ID', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'created_at', label: 'Created At', type: 'datetime', aggregatable: false, groupable: true, filterable: true },
    ],
    relations: [
      { name: 'organization', label: 'Organization', targetObject: 'organizations', type: 'belongs_to', foreignKey: 'organization_id', targetKey: 'id' },
      { name: 'person', label: 'Person', targetObject: 'people', type: 'belongs_to', foreignKey: 'person_id', targetKey: 'id' },
      { name: 'opportunity', label: 'Opportunity', targetObject: 'opportunities', type: 'belongs_to', foreignKey: 'opportunity_id', targetKey: 'id' },
    ],
  },

  meetings: {
    name: 'meetings',
    label: 'Meeting',
    labelPlural: 'Meetings',
    softDelete: false,
    projectScoped: true,
    fields: [
      { name: 'id', label: 'ID', type: 'uuid', aggregatable: false, groupable: false, filterable: true },
      { name: 'title', label: 'Title', type: 'text', aggregatable: false, groupable: false, filterable: true },
      { name: 'scheduled_at', label: 'Scheduled At', type: 'datetime', aggregatable: false, groupable: true, filterable: true },
      { name: 'status', label: 'Status', type: 'enum', aggregatable: false, groupable: true, filterable: true, enumValues: ['scheduled', 'attended', 'no_show', 'cancelled'] },
      { name: 'organization_id', label: 'Organization ID', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'person_id', label: 'Person ID', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'opportunity_id', label: 'Opportunity ID', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'created_by', label: 'Created By', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'created_at', label: 'Created At', type: 'datetime', aggregatable: false, groupable: true, filterable: true },
    ],
    relations: [
      { name: 'organization', label: 'Organization', targetObject: 'organizations', type: 'belongs_to', foreignKey: 'organization_id', targetKey: 'id' },
      { name: 'person', label: 'Person', targetObject: 'people', type: 'belongs_to', foreignKey: 'person_id', targetKey: 'id' },
      { name: 'opportunity', label: 'Opportunity', targetObject: 'opportunities', type: 'belongs_to', foreignKey: 'opportunity_id', targetKey: 'id' },
    ],
  },

  sequence_enrollments: {
    name: 'sequence_enrollments',
    label: 'Sequence Enrollment',
    labelPlural: 'Sequence Enrollments',
    softDelete: false,
    projectScoped: false,
    fields: [
      { name: 'id', label: 'ID', type: 'uuid', aggregatable: false, groupable: false, filterable: true },
      { name: 'status', label: 'Status', type: 'text', aggregatable: false, groupable: true, filterable: true },
      { name: 'person_id', label: 'Person ID', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'sequence_id', label: 'Sequence ID', type: 'uuid', aggregatable: false, groupable: true, filterable: true },
      { name: 'current_step', label: 'Current Step', type: 'number', aggregatable: true, groupable: true, filterable: true },
      { name: 'completed_at', label: 'Completed At', type: 'datetime', aggregatable: false, groupable: true, filterable: true },
      { name: 'created_at', label: 'Created At', type: 'datetime', aggregatable: false, groupable: true, filterable: true },
      { name: 'updated_at', label: 'Updated At', type: 'datetime', aggregatable: false, groupable: false, filterable: true },
    ],
    relations: [
      { name: 'person', label: 'Person', targetObject: 'people', type: 'belongs_to', foreignKey: 'person_id', targetKey: 'id' },
    ],
  },
};

// ── Custom Field Type Mapping ───────────────────────────────────────────────

const CUSTOM_FIELD_TYPE_MAP: Record<string, { type: ReportableField['type']; aggregatable: boolean }> = {
  text: { type: 'text', aggregatable: false },
  textarea: { type: 'text', aggregatable: false },
  number: { type: 'number', aggregatable: true },
  currency: { type: 'currency', aggregatable: true },
  percentage: { type: 'percentage', aggregatable: true },
  date: { type: 'date', aggregatable: false },
  datetime: { type: 'datetime', aggregatable: false },
  boolean: { type: 'boolean', aggregatable: false },
  select: { type: 'text', aggregatable: false },
  multi_select: { type: 'text', aggregatable: false },
  url: { type: 'text', aggregatable: false },
  email: { type: 'text', aggregatable: false },
  phone: { type: 'text', aggregatable: false },
  rating: { type: 'number', aggregatable: true },
  user: { type: 'uuid', aggregatable: false },
};

// Entity type mapping from custom_field_definitions.entity_type to table name
const ENTITY_TYPE_TO_TABLE: Record<string, string> = {
  organization: 'organizations',
  person: 'people',
  opportunity: 'opportunities',
  rfp: 'rfps',
};

// ── Schema Builder ──────────────────────────────────────────────────────────

/**
 * Returns the static schema registry (no custom fields).
 * Use this when you don't need project-specific custom fields.
 */
export function getStaticSchema(): ReportSchema {
  return { objects: structuredClone(REPORTABLE_OBJECTS) };
}

/**
 * Returns the full schema with project-specific custom fields merged in.
 */
export async function getReportSchema(projectId: string): Promise<ReportSchema> {
  const schema = structuredClone(REPORTABLE_OBJECTS);

  try {
    const supabase = createAdminClient();
    const { data: customFields } = await supabase
      .from('custom_field_definitions')
      .select('id, entity_type, name, label, field_type, is_filterable, options')
      .eq('project_id', projectId)
      .order('display_order', { ascending: true });

    if (customFields) {
      for (const cf of customFields) {
        const tableName = ENTITY_TYPE_TO_TABLE[cf.entity_type];
        if (!tableName || !schema[tableName]) continue;

        const typeMapping = CUSTOM_FIELD_TYPE_MAP[cf.field_type] ?? { type: 'text' as const, aggregatable: false };
        const field: ReportableField = {
          name: `custom_fields.${cf.name}`,
          label: cf.label,
          type: typeMapping.type,
          aggregatable: typeMapping.aggregatable,
          groupable: true,
          filterable: cf.is_filterable ?? true,
          isCustomField: true,
        };

        // Add enum values for select fields
        if ((cf.field_type === 'select' || cf.field_type === 'multi_select') && cf.options) {
          const opts = cf.options as { value: string; label: string }[];
          if (Array.isArray(opts)) {
            field.enumValues = opts.map((o) => (typeof o === 'string' ? o : o.value)).filter(Boolean) as string[];
          }
        }

        schema[tableName].fields.push(field);
      }
    }
  } catch (error) {
    console.error('Error loading custom fields for report schema:', error);
    // Return schema without custom fields rather than failing
  }

  return { objects: schema };
}

/**
 * Validates that an object name exists in the registry.
 */
export function isValidObject(objectName: string): boolean {
  return objectName in REPORTABLE_OBJECTS;
}

/**
 * Returns the set of valid table names (for SQL allowlisting).
 */
export function getAllowedTableNames(): Set<string> {
  return new Set(Object.keys(REPORTABLE_OBJECTS));
}

/**
 * Returns the set of valid column names for a given table (for SQL allowlisting).
 */
export function getAllowedColumnNames(objectName: string): Set<string> {
  const obj = REPORTABLE_OBJECTS[objectName];
  if (!obj) return new Set();
  return new Set(obj.fields.filter((f) => !f.isCustomField).map((f) => f.name));
}

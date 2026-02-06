import type { EntityType, CustomFieldDefinition } from '@/types/custom-field';
import type { ColumnDefinition, ColumnConfig } from '@/types/table-columns';

// System column definitions for Organizations
export const ORGANIZATION_COLUMNS: ColumnDefinition[] = [
  { key: 'name', label: 'Organization', type: 'system', fieldType: 'text', sortable: true, defaultVisible: true, minWidth: 200 },
  { key: 'industry', label: 'Industry', type: 'system', fieldType: 'text', sortable: true, defaultVisible: true },
  { key: 'website', label: 'Website', type: 'system', fieldType: 'url', sortable: false, defaultVisible: true },
  { key: 'employee_count', label: 'Employees', type: 'system', fieldType: 'number', sortable: true, defaultVisible: true },
  { key: 'annual_revenue', label: 'Revenue', type: 'system', fieldType: 'currency', sortable: true, defaultVisible: false },
  { key: 'domain', label: 'Domain', type: 'system', fieldType: 'text', sortable: true, defaultVisible: false },
  { key: 'phone', label: 'Phone', type: 'system', fieldType: 'phone', sortable: false, defaultVisible: false },
  { key: 'linkedin_url', label: 'LinkedIn', type: 'system', fieldType: 'url', sortable: false, defaultVisible: false },
  { key: 'address_city', label: 'City', type: 'system', fieldType: 'text', sortable: true, defaultVisible: false },
  { key: 'address_state', label: 'State', type: 'system', fieldType: 'text', sortable: true, defaultVisible: false },
  { key: 'address_country', label: 'Country', type: 'system', fieldType: 'text', sortable: true, defaultVisible: false },
  { key: 'created_at', label: 'Created', type: 'system', fieldType: 'datetime', sortable: true, defaultVisible: false },
  { key: 'updated_at', label: 'Updated', type: 'system', fieldType: 'datetime', sortable: true, defaultVisible: false },
];

// System column definitions for People
export const PERSON_COLUMNS: ColumnDefinition[] = [
  { key: 'name', label: 'Name', type: 'system', fieldType: 'text', sortable: true, defaultVisible: true, minWidth: 180 },
  { key: 'job_title', label: 'Title', type: 'system', fieldType: 'text', sortable: true, defaultVisible: true },
  { key: 'email', label: 'Email', type: 'system', fieldType: 'email', sortable: true, defaultVisible: true },
  { key: 'phone', label: 'Phone', type: 'system', fieldType: 'phone', sortable: false, defaultVisible: true },
  { key: 'department', label: 'Department', type: 'system', fieldType: 'text', sortable: true, defaultVisible: false },
  { key: 'mobile_phone', label: 'Mobile', type: 'system', fieldType: 'phone', sortable: false, defaultVisible: false },
  { key: 'linkedin_url', label: 'LinkedIn', type: 'system', fieldType: 'url', sortable: false, defaultVisible: false },
  { key: 'organization', label: 'Organization', type: 'system', fieldType: 'text', sortable: true, defaultVisible: false, entityReference: 'organization' },
  { key: 'address_city', label: 'City', type: 'system', fieldType: 'text', sortable: true, defaultVisible: false },
  { key: 'address_state', label: 'State', type: 'system', fieldType: 'text', sortable: true, defaultVisible: false },
  { key: 'timezone', label: 'Timezone', type: 'system', fieldType: 'text', sortable: true, defaultVisible: false },
  { key: 'created_at', label: 'Created', type: 'system', fieldType: 'datetime', sortable: true, defaultVisible: false },
  { key: 'updated_at', label: 'Updated', type: 'system', fieldType: 'datetime', sortable: true, defaultVisible: false },
];

// System column definitions for Opportunities
export const OPPORTUNITY_COLUMNS: ColumnDefinition[] = [
  { key: 'name', label: 'Name', type: 'system', fieldType: 'text', sortable: true, defaultVisible: true, minWidth: 180 },
  { key: 'stage', label: 'Stage', type: 'system', fieldType: 'select', sortable: true, defaultVisible: true },
  { key: 'amount', label: 'Amount', type: 'system', fieldType: 'currency', sortable: true, defaultVisible: true },
  { key: 'probability', label: 'Probability', type: 'system', fieldType: 'percentage', sortable: true, defaultVisible: true },
  { key: 'expected_close_date', label: 'Expected Close', type: 'system', fieldType: 'date', sortable: true, defaultVisible: true },
  { key: 'organization', label: 'Organization', type: 'system', fieldType: 'text', sortable: true, defaultVisible: false, entityReference: 'organization' },
  { key: 'primary_contact', label: 'Primary Contact', type: 'system', fieldType: 'text', sortable: true, defaultVisible: false, entityReference: 'person' },
  { key: 'source', label: 'Source', type: 'system', fieldType: 'text', sortable: true, defaultVisible: false },
  { key: 'campaign', label: 'Campaign', type: 'system', fieldType: 'text', sortable: true, defaultVisible: false },
  { key: 'days_in_stage', label: 'Days in Stage', type: 'system', fieldType: 'number', sortable: true, defaultVisible: false },
  { key: 'actual_close_date', label: 'Actual Close', type: 'system', fieldType: 'date', sortable: true, defaultVisible: false },
  { key: 'competitor', label: 'Competitor', type: 'system', fieldType: 'text', sortable: true, defaultVisible: false },
  { key: 'created_at', label: 'Created', type: 'system', fieldType: 'datetime', sortable: true, defaultVisible: false },
  { key: 'updated_at', label: 'Updated', type: 'system', fieldType: 'datetime', sortable: true, defaultVisible: false },
];

// System column definitions for RFPs
export const RFP_COLUMNS: ColumnDefinition[] = [
  { key: 'title', label: 'Title', type: 'system', fieldType: 'text', sortable: true, defaultVisible: true, minWidth: 200 },
  { key: 'status', label: 'Status', type: 'system', fieldType: 'select', sortable: true, defaultVisible: true },
  { key: 'progress', label: 'Progress', type: 'system', fieldType: 'text', sortable: false, defaultVisible: true },
  { key: 'due_date', label: 'Due Date', type: 'system', fieldType: 'datetime', sortable: true, defaultVisible: true },
  { key: 'estimated_value', label: 'Est. Value', type: 'system', fieldType: 'currency', sortable: true, defaultVisible: true },
  { key: 'organization', label: 'Organization', type: 'system', fieldType: 'text', sortable: true, defaultVisible: false, entityReference: 'organization' },
  { key: 'rfp_number', label: 'RFP Number', type: 'system', fieldType: 'text', sortable: true, defaultVisible: false },
  { key: 'win_probability', label: 'Win Probability', type: 'system', fieldType: 'percentage', sortable: true, defaultVisible: false },
  { key: 'issue_date', label: 'Issue Date', type: 'system', fieldType: 'date', sortable: true, defaultVisible: false },
  { key: 'questions_due_date', label: 'Questions Due', type: 'system', fieldType: 'datetime', sortable: true, defaultVisible: false },
  { key: 'decision_date', label: 'Decision Date', type: 'system', fieldType: 'date', sortable: true, defaultVisible: false },
  { key: 'go_no_go_decision', label: 'Go/No-Go', type: 'system', fieldType: 'text', sortable: true, defaultVisible: false },
  { key: 'budget_range', label: 'Budget Range', type: 'system', fieldType: 'text', sortable: false, defaultVisible: false },
  { key: 'submission_method', label: 'Submission Method', type: 'system', fieldType: 'text', sortable: false, defaultVisible: false },
  { key: 'created_at', label: 'Created', type: 'system', fieldType: 'datetime', sortable: true, defaultVisible: false },
  { key: 'updated_at', label: 'Updated', type: 'system', fieldType: 'datetime', sortable: true, defaultVisible: false },
];

// Map of entity types to their column definitions
export const COLUMN_DEFINITIONS: Record<EntityType, ColumnDefinition[]> = {
  organization: ORGANIZATION_COLUMNS,
  person: PERSON_COLUMNS,
  opportunity: OPPORTUNITY_COLUMNS,
  rfp: RFP_COLUMNS,
};

// Default visible columns for each entity (for new users)
export const DEFAULT_VISIBLE_COLUMNS: Record<EntityType, string[]> = {
  organization: ['name', 'industry', 'website', 'employee_count'],
  person: ['name', 'job_title', 'email', 'phone'],
  opportunity: ['name', 'stage', 'amount', 'probability', 'expected_close_date'],
  rfp: ['title', 'status', 'progress', 'due_date', 'estimated_value'],
};

/**
 * Get all available columns for an entity type, including custom fields
 */
export function getColumnsWithCustomFields(
  entityType: EntityType,
  customFields: CustomFieldDefinition[]
): ColumnDefinition[] {
  const systemColumns = COLUMN_DEFINITIONS[entityType];

  // For organizations, show all custom fields in column picker
  // For other entities, only show fields marked as visible_in_list
  const customColumns: ColumnDefinition[] = customFields
    .filter(f => entityType === 'organization' || f.is_visible_in_list)
    .map(f => ({
      key: `custom_${f.id}`,
      label: f.label,
      type: 'custom' as const,
      fieldType: f.field_type,
      sortable: true,
      defaultVisible: false,
    }));

  return [...systemColumns, ...customColumns];
}

/**
 * Generate default column config from column definitions
 */
export function getDefaultColumnConfig(entityType: EntityType): ColumnConfig[] {
  const columns = COLUMN_DEFINITIONS[entityType];
  const defaultVisible = DEFAULT_VISIBLE_COLUMNS[entityType];

  return columns.map((col, index) => ({
    key: col.key,
    visible: defaultVisible.includes(col.key),
    order: index,
  }));
}

/**
 * Get the accessor path for a column key
 * Some columns need special handling (e.g., nested paths, computed values)
 */
export function getColumnAccessor(key: string): string | ((item: Record<string, unknown>) => unknown) {
  // Handle address fields
  if (key.startsWith('address_')) {
    const addressField = key.replace('address_', '');
    return (item: Record<string, unknown>) => {
      const address = item.address as Record<string, unknown> | null;
      return address?.[addressField] ?? null;
    };
  }

  // Handle person name (first_name + last_name)
  if (key === 'name') {
    return (item: Record<string, unknown>) => {
      // For people, combine first and last name
      if ('first_name' in item) {
        return `${item.first_name || ''} ${item.last_name || ''}`.trim();
      }
      // For other entities, just return name
      return item.name;
    };
  }

  // Handle organization reference
  if (key === 'organization') {
    return (item: Record<string, unknown>) => {
      const org = item.organization as Record<string, unknown> | null;
      return org?.name ?? null;
    };
  }

  // Handle primary contact reference
  if (key === 'primary_contact') {
    return (item: Record<string, unknown>) => {
      const contact = item.primary_contact as Record<string, unknown> | null;
      if (!contact) return null;
      return `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
    };
  }

  // Handle custom fields
  if (key.startsWith('custom_')) {
    const fieldId = key.replace('custom_', '');
    return (item: Record<string, unknown>) => {
      const customFields = item.custom_fields as Record<string, unknown> | null;
      return customFields?.[fieldId] ?? null;
    };
  }

  // Default: direct property access
  return key;
}

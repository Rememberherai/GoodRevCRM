import type { Database, Json } from './database';

// Entity types that support custom fields
export type EntityType = Database['public']['Enums']['entity_type'];
export const ENTITY_TYPES: EntityType[] = [
  'organization',
  'person',
  'opportunity',
  'rfp',
];

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  organization: 'Organizations',
  person: 'People',
  opportunity: 'Opportunities',
  rfp: 'RFPs',
};

// Field types supported by the system
export type FieldType = Database['public']['Enums']['field_type'];
export const FIELD_TYPES: FieldType[] = [
  'text',
  'textarea',
  'number',
  'currency',
  'percentage',
  'date',
  'datetime',
  'boolean',
  'select',
  'multi_select',
  'url',
  'email',
  'phone',
  'rating',
  'user',
];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Text',
  textarea: 'Text Area',
  number: 'Number',
  currency: 'Currency',
  percentage: 'Percentage',
  date: 'Date',
  datetime: 'Date & Time',
  boolean: 'Yes/No',
  select: 'Single Select',
  multi_select: 'Multi Select',
  url: 'URL',
  email: 'Email',
  phone: 'Phone',
  rating: 'Rating',
  user: 'User',
};

export const FIELD_TYPE_DESCRIPTIONS: Record<FieldType, string> = {
  text: 'Single line of text',
  textarea: 'Multiple lines of text',
  number: 'Numeric value',
  currency: 'Monetary value with currency',
  percentage: 'Value between 0-100%',
  date: 'Calendar date',
  datetime: 'Date with time',
  boolean: 'Yes or no checkbox',
  select: 'Choose one option from a list',
  multi_select: 'Choose multiple options from a list',
  url: 'Website URL',
  email: 'Email address',
  phone: 'Phone number',
  rating: 'Star rating (1-5)',
  user: 'Team member reference',
};

// Database types
export type CustomFieldDefinition = Database['public']['Tables']['custom_field_definitions']['Row'];
export type CustomFieldDefinitionInsert = Database['public']['Tables']['custom_field_definitions']['Insert'];
export type CustomFieldDefinitionUpdate = Database['public']['Tables']['custom_field_definitions']['Update'];

// Options for select/multi_select fields
export interface SelectOption {
  value: string;
  label: string;
  color?: string;
}

// Validation rules that can be applied to fields
export interface ValidationRules {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  patternMessage?: string;
}

// Extended field definition with parsed options
export interface CustomFieldDefinitionWithOptions extends Omit<CustomFieldDefinition, 'options' | 'default_value' | 'validation_rules'> {
  options: SelectOption[];
  default_value: Json | null;
  validation_rules: ValidationRules | null;
}

// System fields that are not custom (built-in columns)
export interface SystemField {
  name: string;
  label: string;
  field_type: FieldType;
  is_required: boolean;
  is_searchable: boolean;
  is_filterable: boolean;
  description?: string;
}

// System fields for each entity type
export const ORGANIZATION_SYSTEM_FIELDS: SystemField[] = [
  { name: 'name', label: 'Name', field_type: 'text', is_required: true, is_searchable: true, is_filterable: false },
  { name: 'domain', label: 'Domain', field_type: 'text', is_required: false, is_searchable: true, is_filterable: false },
  { name: 'website', label: 'Website', field_type: 'url', is_required: false, is_searchable: false, is_filterable: false },
  { name: 'industry', label: 'Industry', field_type: 'text', is_required: false, is_searchable: true, is_filterable: true },
  { name: 'employee_count', label: 'Employee Count', field_type: 'number', is_required: false, is_searchable: false, is_filterable: true },
  { name: 'annual_revenue', label: 'Annual Revenue', field_type: 'currency', is_required: false, is_searchable: false, is_filterable: true },
  { name: 'description', label: 'Description', field_type: 'textarea', is_required: false, is_searchable: true, is_filterable: false },
  { name: 'phone', label: 'Phone', field_type: 'phone', is_required: false, is_searchable: false, is_filterable: false },
  { name: 'linkedin_url', label: 'LinkedIn', field_type: 'url', is_required: false, is_searchable: false, is_filterable: false },
];

export const PERSON_SYSTEM_FIELDS: SystemField[] = [
  { name: 'first_name', label: 'First Name', field_type: 'text', is_required: true, is_searchable: true, is_filterable: false },
  { name: 'last_name', label: 'Last Name', field_type: 'text', is_required: true, is_searchable: true, is_filterable: false },
  { name: 'email', label: 'Email', field_type: 'email', is_required: false, is_searchable: true, is_filterable: false },
  { name: 'phone', label: 'Phone', field_type: 'phone', is_required: false, is_searchable: false, is_filterable: false },
  { name: 'mobile_phone', label: 'Mobile Phone', field_type: 'phone', is_required: false, is_searchable: false, is_filterable: false },
  { name: 'job_title', label: 'Job Title', field_type: 'text', is_required: false, is_searchable: true, is_filterable: true },
  { name: 'department', label: 'Department', field_type: 'text', is_required: false, is_searchable: true, is_filterable: true },
  { name: 'linkedin_url', label: 'LinkedIn', field_type: 'url', is_required: false, is_searchable: false, is_filterable: false },
  { name: 'notes', label: 'Notes', field_type: 'textarea', is_required: false, is_searchable: true, is_filterable: false },
];

export const OPPORTUNITY_SYSTEM_FIELDS: SystemField[] = [
  { name: 'name', label: 'Name', field_type: 'text', is_required: true, is_searchable: true, is_filterable: false },
  { name: 'stage', label: 'Stage', field_type: 'select', is_required: true, is_searchable: false, is_filterable: true },
  { name: 'amount', label: 'Amount', field_type: 'currency', is_required: false, is_searchable: false, is_filterable: true },
  { name: 'probability', label: 'Probability', field_type: 'percentage', is_required: false, is_searchable: false, is_filterable: true },
  { name: 'expected_close_date', label: 'Expected Close Date', field_type: 'date', is_required: false, is_searchable: false, is_filterable: true },
  { name: 'description', label: 'Description', field_type: 'textarea', is_required: false, is_searchable: true, is_filterable: false },
  { name: 'source', label: 'Source', field_type: 'text', is_required: false, is_searchable: true, is_filterable: true },
  { name: 'campaign', label: 'Campaign', field_type: 'text', is_required: false, is_searchable: true, is_filterable: true },
];

export const RFP_SYSTEM_FIELDS: SystemField[] = [
  { name: 'title', label: 'Title', field_type: 'text', is_required: true, is_searchable: true, is_filterable: false },
  { name: 'status', label: 'Status', field_type: 'select', is_required: true, is_searchable: false, is_filterable: true },
  { name: 'rfp_number', label: 'RFP Number', field_type: 'text', is_required: false, is_searchable: true, is_filterable: false },
  { name: 'due_date', label: 'Due Date', field_type: 'datetime', is_required: false, is_searchable: false, is_filterable: true },
  { name: 'estimated_value', label: 'Estimated Value', field_type: 'currency', is_required: false, is_searchable: false, is_filterable: true },
  { name: 'win_probability', label: 'Win Probability', field_type: 'percentage', is_required: false, is_searchable: false, is_filterable: true },
  { name: 'description', label: 'Description', field_type: 'textarea', is_required: false, is_searchable: true, is_filterable: false },
];

export const SYSTEM_FIELDS_BY_ENTITY: Record<EntityType, SystemField[]> = {
  organization: ORGANIZATION_SYSTEM_FIELDS,
  person: PERSON_SYSTEM_FIELDS,
  opportunity: OPPORTUNITY_SYSTEM_FIELDS,
  rfp: RFP_SYSTEM_FIELDS,
};

// Helper to get display value for a field
export function getFieldDisplayValue(
  value: unknown,
  fieldType: FieldType,
  options?: SelectOption[]
): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  switch (fieldType) {
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'date':
      return new Date(value as string).toLocaleDateString();
    case 'datetime':
      return new Date(value as string).toLocaleString();
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(value as number);
    case 'percentage':
      return `${value}%`;
    case 'rating':
      return '★'.repeat(value as number) + '☆'.repeat(5 - (value as number));
    case 'select':
      if (options) {
        const option = options.find((o) => o.value === value);
        return option?.label ?? String(value);
      }
      return String(value);
    case 'multi_select':
      if (Array.isArray(value) && options) {
        return value
          .map((v) => options.find((o) => o.value === v)?.label ?? v)
          .join(', ');
      }
      return String(value);
    case 'url':
      return String(value);
    default:
      return String(value);
  }
}

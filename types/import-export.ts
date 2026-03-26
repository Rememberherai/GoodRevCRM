// Import/Export types

export type ImportExportEntityType =
  | 'person'
  | 'organization'
  | 'opportunity'
  | 'task'
  | 'grant';

export type ImportStatus =
  | 'pending'
  | 'validating'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ExportStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'expired';

export type ExportFormat = 'csv' | 'xlsx' | 'json';

export interface ImportJob {
  id: string;
  project_id: string;
  user_id: string;
  entity_type: ImportExportEntityType;
  status: ImportStatus;
  file_name: string;
  file_url: string | null;
  total_rows: number;
  processed_rows: number;
  successful_rows: number;
  failed_rows: number;
  error_log: ImportError[];
  mapping: ImportMapping;
  options: ImportOptions;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportError {
  row: number;
  field?: string;
  message: string;
  value?: unknown;
}

export interface ImportMapping {
  [sourceColumn: string]: string; // Maps CSV column to entity field
}

export interface ImportOptions {
  skip_duplicates?: boolean;
  update_existing?: boolean;
  duplicate_key?: string;
  skip_header?: boolean;
  delimiter?: string;
}

export interface ExportJob {
  id: string;
  project_id: string;
  user_id: string;
  entity_type: ImportExportEntityType;
  status: ExportStatus;
  format: ExportFormat;
  file_name: string | null;
  file_url: string | null;
  total_rows: number;
  filters: ExportFilters;
  columns: string[];
  started_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExportFilters {
  [field: string]: unknown;
}

// Field mapping definitions for each entity type
export interface FieldDefinition {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'email' | 'url' | 'uuid';
  required: boolean;
}

export const personFields: FieldDefinition[] = [
  { name: 'first_name', label: 'First Name', type: 'string', required: true },
  { name: 'last_name', label: 'Last Name', type: 'string', required: true },
  { name: 'email', label: 'Email', type: 'email', required: false },
  { name: 'phone', label: 'Phone', type: 'string', required: false },
  { name: 'title', label: 'Job Title', type: 'string', required: false },
  { name: 'linkedin_url', label: 'LinkedIn URL', type: 'url', required: false },
  { name: 'status', label: 'Status', type: 'string', required: false },
];

export const organizationFields: FieldDefinition[] = [
  { name: 'name', label: 'Name', type: 'string', required: true },
  { name: 'domain', label: 'Domain', type: 'string', required: false },
  { name: 'industry', label: 'Industry', type: 'string', required: false },
  { name: 'size', label: 'Size', type: 'string', required: false },
  { name: 'website', label: 'Website', type: 'url', required: false },
  { name: 'linkedin_url', label: 'LinkedIn URL', type: 'url', required: false },
  { name: 'status', label: 'Status', type: 'string', required: false },
];

export const opportunityFields: FieldDefinition[] = [
  { name: 'title', label: 'Title', type: 'string', required: true },
  { name: 'value', label: 'Value', type: 'number', required: false },
  { name: 'stage', label: 'Stage', type: 'string', required: false },
  { name: 'status', label: 'Status', type: 'string', required: false },
  { name: 'expected_close_date', label: 'Expected Close Date', type: 'date', required: false },
  { name: 'probability', label: 'Probability (%)', type: 'number', required: false },
];

export const taskFields: FieldDefinition[] = [
  { name: 'title', label: 'Title', type: 'string', required: true },
  { name: 'description', label: 'Description', type: 'string', required: false },
  { name: 'status', label: 'Status', type: 'string', required: false },
  { name: 'priority', label: 'Priority', type: 'string', required: false },
  { name: 'due_date', label: 'Due Date', type: 'date', required: false },
];

export const grantFields: FieldDefinition[] = [
  { name: 'name', label: 'Grant Name', type: 'string', required: true },
  { name: 'status', label: 'Status', type: 'string', required: false },
  { name: 'category', label: 'Category', type: 'string', required: false },
  { name: 'amount_requested', label: 'Amount Requested', type: 'number', required: false },
  { name: 'amount_awarded', label: 'Amount Awarded', type: 'number', required: false },
  { name: 'funding_range_min', label: 'Funding Range Min', type: 'number', required: false },
  { name: 'funding_range_max', label: 'Funding Range Max', type: 'number', required: false },
  { name: 'funder_name', label: 'Funder Organization', type: 'string', required: false },
  { name: 'mission_fit', label: 'Mission Fit (1-5)', type: 'number', required: false },
  { name: 'tier', label: 'Tier (1-3)', type: 'number', required: false },
  { name: 'urgency', label: 'Urgency', type: 'string', required: false },
  { name: 'loi_due_at', label: 'LOI Due Date', type: 'date', required: false },
  { name: 'application_due_at', label: 'Application Due Date', type: 'date', required: false },
  { name: 'report_due_at', label: 'Report Due Date', type: 'date', required: false },
  { name: 'application_url', label: 'Application URL', type: 'url', required: false },
  { name: 'key_intel', label: 'Key Intel', type: 'string', required: false },
  { name: 'recommended_strategy', label: 'Recommended Strategy', type: 'string', required: false },
  { name: 'notes', label: 'Notes', type: 'string', required: false },
  // Post-award fields
  { name: 'award_number', label: 'Award Number', type: 'string', required: false },
  { name: 'funder_grant_id', label: 'Funder Grant ID', type: 'string', required: false },
  { name: 'award_period_start', label: 'Award Period Start', type: 'date', required: false },
  { name: 'award_period_end', label: 'Award Period End', type: 'date', required: false },
  { name: 'total_award_amount', label: 'Total Award Amount', type: 'number', required: false },
  { name: 'match_required', label: 'Match Required', type: 'number', required: false },
  { name: 'match_type', label: 'Match Type', type: 'string', required: false },
  { name: 'indirect_cost_rate', label: 'Indirect Cost Rate', type: 'number', required: false },
  { name: 'agreement_status', label: 'Agreement Status', type: 'string', required: false },
  { name: 'closeout_date', label: 'Closeout Date', type: 'date', required: false },
  { name: 'source_url', label: 'Source URL', type: 'url', required: false },
];

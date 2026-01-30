// Import/Export types

export type ImportExportEntityType =
  | 'person'
  | 'organization'
  | 'opportunity'
  | 'task';

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

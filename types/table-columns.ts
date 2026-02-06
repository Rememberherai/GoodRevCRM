import type { EntityType, FieldType } from './custom-field';

// Single column configuration (user preferences)
export interface ColumnConfig {
  key: string;           // Unique column identifier (field name or custom_field_id)
  visible: boolean;      // Whether column is shown
  order: number;         // Display order (0-based)
  width?: number;        // Optional column width in pixels
}

// Column definition (describes what a column is)
export interface ColumnDefinition {
  key: string;
  label: string;
  type: 'system' | 'custom';  // System field vs custom field
  fieldType: FieldType;       // For rendering logic
  sortable?: boolean;
  defaultVisible?: boolean;
  minWidth?: number;
  maxWidth?: number;
  // For columns that reference other entities
  entityReference?: 'organization' | 'person' | 'opportunity' | 'rfp';
}

// User's column preferences for an entity (database row)
export interface TableColumnPreferences {
  id: string;
  project_id: string;
  user_id: string;
  entity_type: EntityType;
  columns: ColumnConfig[];
  created_at: string;
  updated_at: string;
}

// Column with merged definition and user config (for rendering)
export interface ResolvedColumn extends ColumnDefinition {
  visible: boolean;
  order: number;
  width?: number;
}

// API request/response types
export interface SaveColumnPreferencesRequest {
  entity_type: EntityType;
  columns: ColumnConfig[];
}

export interface ColumnPreferencesResponse {
  preferences: TableColumnPreferences | null;
  defaults: ColumnConfig[];
}

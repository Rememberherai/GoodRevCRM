// Base types for GoodRev CRM

export type EntityType = 'organization' | 'person' | 'opportunity' | 'rfp';

export interface BaseEntity {
  id: string;
  project_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  settings: Record<string, unknown>;
  owner_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProjectMembership {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  invited_by: string | null;
  invited_at: string | null;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

// Field types for custom fields
export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'currency'
  | 'percentage'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'select'
  | 'multi_select'
  | 'url'
  | 'email'
  | 'phone'
  | 'rating'
  | 'user';

export interface SelectOption {
  value: string;
  label: string;
  color?: string;
}

export interface FieldOptions {
  // For select/multi_select
  options?: SelectOption[];
  // For number/currency/percentage/rating
  min?: number;
  max?: number;
  precision?: number;
  // For text/textarea
  min_length?: number;
  max_length?: number;
  placeholder?: string;
  // For date/datetime
  min_date?: string;
  max_date?: string;
}

export interface CustomFieldDefinition {
  id: string;
  project_id: string;
  entity_type: EntityType;
  name: string;
  label: string;
  description: string | null;
  field_type: FieldType;
  is_required: boolean;
  is_unique: boolean;
  is_searchable: boolean;
  is_filterable: boolean;
  is_visible_in_list: boolean;
  display_order: number;
  group_name: string | null;
  options: FieldOptions;
  default_value: unknown;
  validation_rules: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Opportunity stages
export type OpportunityStage =
  | 'prospecting'
  | 'qualification'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';

// RFP status
export type RfpStatus =
  | 'identified'
  | 'reviewing'
  | 'preparing'
  | 'submitted'
  | 'won'
  | 'lost'
  | 'no_bid';

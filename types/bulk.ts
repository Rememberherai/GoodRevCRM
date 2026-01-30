// Bulk operation types

export type BulkEntityType = 'person' | 'organization' | 'opportunity' | 'task';

export type BulkOperation =
  | 'update'
  | 'delete'
  | 'restore'
  | 'assign'
  | 'unassign'
  | 'add_tags'
  | 'remove_tags'
  | 'complete'; // For tasks only

export interface BulkOperationRequest {
  entity_type: BulkEntityType;
  entity_ids: string[];
  operation: BulkOperation;
  data?: Record<string, unknown>;
}

export interface BulkOperationResult {
  success: boolean;
  affected_count: number;
  errors?: string[];
}

// Tag types
export interface EntityTag {
  id: string;
  project_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface EntityTagAssignment {
  id: string;
  tag_id: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
}

export interface TagWithCount extends EntityTag {
  assignment_count: number;
}

// Bulk update payloads
export interface BulkPersonUpdate {
  status?: string;
  owner_id?: string;
}

export interface BulkOrganizationUpdate {
  status?: string;
  owner_id?: string;
}

export interface BulkOpportunityUpdate {
  stage?: string;
  status?: string;
  owner_id?: string;
}

export interface BulkTaskUpdate {
  status?: string;
  priority?: string;
  assignee_id?: string;
  due_date?: string;
}

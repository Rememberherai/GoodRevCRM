// Activity types
export type ActivityEntityType =
  | 'person'
  | 'organization'
  | 'opportunity'
  | 'rfp'
  | 'task'
  | 'note'
  | 'sequence'
  | 'email';

export type ActivityAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'restored'
  | 'assigned'
  | 'unassigned'
  | 'status_changed'
  | 'stage_changed'
  | 'enrolled'
  | 'unenrolled'
  | 'sent'
  | 'opened'
  | 'clicked'
  | 'replied';

// Activity change record
export interface ActivityChange {
  field: string;
  old_value: unknown;
  new_value: unknown;
}

// Activity log entry
export interface ActivityLog {
  id: string;
  project_id: string;
  user_id: string;
  entity_type: ActivityEntityType;
  entity_id: string;
  action: ActivityAction;
  changes: Record<string, { old: unknown; new: unknown }>;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// Activity with user info
export interface ActivityWithUser extends ActivityLog {
  user?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

// Activity summary for timeline display
export interface ActivitySummary {
  id: string;
  entity_type: ActivityEntityType;
  entity_id: string;
  action: ActivityAction;
  description: string;
  user_name: string | null;
  user_avatar: string | null;
  created_at: string;
  metadata?: Record<string, unknown>;
}

// Deduplication system types

export type DeduplicationEntityType = 'person' | 'organization';

export type DetectionSource =
  | 'manual_creation'
  | 'csv_import'
  | 'epa_import'
  | 'contact_discovery'
  | 'bulk_scan';

export type DuplicateStatus = 'pending' | 'allowed' | 'merged';

export type MatchType = 'exact' | 'fuzzy' | 'domain' | 'normalized';

export interface MatchReason {
  field: string;
  match_type: MatchType;
  source_value: string;
  target_value: string;
  contribution: number;
}

export interface DuplicateCandidate {
  id: string;
  project_id: string;
  entity_type: DeduplicationEntityType;
  source_id: string;
  target_id: string;
  match_score: number;
  match_reasons: MatchReason[];
  detection_source: DetectionSource;
  status: DuplicateStatus;
  status_changed_at: string | null;
  status_changed_by: string | null;
  merged_at: string | null;
  merged_by: string | null;
  survivor_id: string | null;
  merge_audit: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface DuplicateCandidateWithRecords extends DuplicateCandidate {
  source_record: Record<string, unknown>;
  target_record: Record<string, unknown>;
}

export interface DetectionMatch {
  target_id: string;
  record: Record<string, unknown>;
  score: number;
  reasons: MatchReason[];
}

export interface DetectionResult {
  has_duplicates: boolean;
  matches: DetectionMatch[];
}

export interface MergeConfig {
  entityType: DeduplicationEntityType;
  survivorId: string;
  mergeIds: string[];
  fieldSelections: Record<string, string>; // fieldName -> sourceRecordId
  projectId: string;
  userId: string;
}

export interface MergeResult {
  merge_history_id: string;
  related_records_moved: Record<string, number>;
  merged_records_snapshot: Record<string, unknown>[];
}

export interface DedupSettings {
  id: string;
  project_id: string;
  min_match_threshold: number;
  auto_merge_threshold: number;
  created_at: string;
  updated_at: string;
}

// Person fields used for duplicate detection
export interface PersonDetectionFields {
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  mobile_phone?: string | null;
  linkedin_url?: string | null;
}

// Organization fields used for duplicate detection
export interface OrganizationDetectionFields {
  name?: string | null;
  domain?: string | null;
  website?: string | null;
  linkedin_url?: string | null;
}

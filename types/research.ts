import type { EntityType } from './custom-field';
import type { OrganizationResearch, PersonResearch } from '@/lib/openrouter/structured-output';

// Research job status
export type ResearchStatus = 'pending' | 'running' | 'completed' | 'failed';

// Research job record
export interface ResearchJob {
  id: string;
  project_id: string;
  entity_type: EntityType;
  entity_id: string;
  status: ResearchStatus;
  prompt: string;
  result: ResearchResult | null;
  error: string | null;
  model_used: string;
  tokens_used: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_by: string;
  created_at: string;
}

// Union type for research results
export type ResearchResult = OrganizationResearch | PersonResearch;

// Research request input
export interface ResearchRequest {
  entity_type: EntityType;
  entity_id: string;
  include_custom_fields?: boolean;
}

// Research result with field mappings
export interface ResearchResultWithMappings {
  job: ResearchJob;
  result: ResearchResult;
  field_mappings: FieldMapping[];
}

// Mapping of research result field to entity field
export interface FieldMapping {
  source_field: string;
  target_field: string;
  target_is_custom: boolean;
  value: unknown;
  confidence: number;
  current_value?: unknown;
  should_update: boolean;
}

// Research application - what to apply from research to entity
export interface ResearchApplication {
  job_id: string;
  entity_type: EntityType;
  entity_id: string;
  field_updates: {
    field_name: string;
    is_custom: boolean;
    value: unknown;
  }[];
}

// Research history entry (for display)
export interface ResearchHistoryEntry {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  entity_name: string;
  status: ResearchStatus;
  fields_updated: number;
  created_at: string;
  completed_at: string | null;
}

// Research stats
export interface ResearchStats {
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  fields_updated: number;
  tokens_used: number;
}

// Constants for research
export const RESEARCH_STATUS_LABELS: Record<ResearchStatus, string> = {
  pending: 'Pending',
  running: 'In Progress',
  completed: 'Completed',
  failed: 'Failed',
};

export const RESEARCH_STATUS_COLORS: Record<ResearchStatus, string> = {
  pending: 'gray',
  running: 'blue',
  completed: 'green',
  failed: 'red',
};

// Field mapping helpers
export const ORGANIZATION_FIELD_MAPPINGS: Record<string, string> = {
  company_name: 'name',
  website: 'website',
  industry: 'industry',
  employee_count: 'employee_count',
  annual_revenue: 'annual_revenue',
  description: 'description',
  'headquarters.city': 'address_city',
  'headquarters.state': 'address_state',
  'headquarters.country': 'address_country',
};

export const PERSON_FIELD_MAPPINGS: Record<string, string> = {
  full_name: '__skip__', // We don't overwrite name
  current_title: 'job_title',
  current_company: '__skip__', // Organization handled separately
  email: 'email',
  phone: 'phone',
  linkedin_url: 'linkedin_url',
  'location.city': 'address_city',
  'location.state': 'address_state',
  'location.country': 'address_country',
  bio: 'notes',
};

// Helper to get nested value from object
export function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

// Helper to create field mappings from research result
export function createFieldMappings(
  result: ResearchResult,
  entityType: EntityType,
  currentEntity: Record<string, unknown>,
  customFieldNames: string[] = []
): FieldMapping[] {
  const mappings: FieldMapping[] = [];
  const fieldMap = entityType === 'organization'
    ? ORGANIZATION_FIELD_MAPPINGS
    : entityType === 'person'
    ? PERSON_FIELD_MAPPINGS
    : {};

  // Map standard fields
  for (const [sourcePath, targetField] of Object.entries(fieldMap)) {
    if (targetField === '__skip__') continue;

    const value = getNestedValue(result, sourcePath);
    if (value === undefined || value === null) continue;

    const confidence = getNestedValue(result, `confidence_scores.${sourcePath.replace('.', '_')}`) as number ?? 0.5;

    mappings.push({
      source_field: sourcePath,
      target_field: targetField,
      target_is_custom: false,
      value,
      confidence,
      current_value: currentEntity[targetField],
      should_update: currentEntity[targetField] === null || currentEntity[targetField] === undefined,
    });
  }

  // Map custom fields
  const customFields = (result as Record<string, unknown>).custom_fields as Record<string, unknown> | undefined;
  if (customFields) {
    for (const fieldName of customFieldNames) {
      const value = customFields[fieldName];
      if (value === undefined || value === null) continue;

      const confidenceScores = (result as Record<string, unknown>).confidence_scores as Record<string, number> | undefined;
      const confidence = confidenceScores?.[`custom_${fieldName}`] ?? 0.5;

      const currentCustomFields = (currentEntity.custom_fields as Record<string, unknown>) ?? {};

      mappings.push({
        source_field: `custom_fields.${fieldName}`,
        target_field: fieldName,
        target_is_custom: true,
        value,
        confidence,
        current_value: currentCustomFields[fieldName],
        should_update: currentCustomFields[fieldName] === null || currentCustomFields[fieldName] === undefined,
      });
    }
  }

  return mappings;
}

import type { EnrichmentPerson, EnrichmentStatus } from '@/lib/fullenrich/client';

// Enrichment job record
export interface EnrichmentJob {
  id: string;
  project_id: string;
  person_id: string;
  external_job_id: string | null;
  status: EnrichmentStatus;
  input_data: EnrichmentInput;
  result: EnrichmentPerson | null;
  error: string | null;
  credits_used: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_by: string;
  created_at: string;
}

// Input data stored with job
export interface EnrichmentInput {
  email?: string;
  linkedin_url?: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  company_domain?: string;
}

// Bulk enrichment request
export interface BulkEnrichmentRequest {
  person_ids: string[];
}

// Enrichment history entry (for display)
export interface EnrichmentHistoryEntry {
  id: string;
  person_id: string;
  person_name: string;
  status: EnrichmentStatus;
  fields_updated: number;
  created_at: string;
  completed_at: string | null;
}

// Enrichment stats
export interface EnrichmentStats {
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  credits_used: number;
  fields_updated: number;
}

// Status labels and colors
export const ENRICHMENT_STATUS_LABELS: Record<EnrichmentStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
};

export const ENRICHMENT_STATUS_COLORS: Record<EnrichmentStatus, string> = {
  pending: 'gray',
  processing: 'blue',
  completed: 'green',
  failed: 'red',
};

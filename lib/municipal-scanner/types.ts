export interface Municipality {
  id: string;
  name: string;
  province: string;
  country: string;
  official_website: string | null;
  minutes_url: string | null;
  population: number | null;
  municipality_type: string | null;
  last_scanned_at: string | null;
  scan_status: string;
  scan_error: string | null;
  rfps_found_count: number;
  created_at: string;
  updated_at: string;
}

export interface ExtractedRfp {
  title: string;
  description: string;
  due_date: string | null;
  estimated_value: number | null;
  currency: string | null;
  submission_method: 'email' | 'portal' | 'physical' | 'other' | null;
  contact_email: string | null;
  confidence: number;
  opportunity_type: 'formal_rfp' | 'project_discussion' | 'planning_stage';
  // Research metadata
  source_meeting_url?: string;
  meeting_date?: string;
  committee_name?: string;
  agenda_item?: string;
  excerpt?: string;
}

export interface ScanResult {
  municipalityId: string;
  municipalityName: string;
  province: string;
  status: 'success' | 'failed' | 'no_minutes';
  minutesFetched: number;
  rfpsDetected: number;
  rfpsCreated: number;
  error?: string;
  startedAt: Date;
  completedAt: Date;
}

export interface ScannerConfig {
  projectId: string;
  dateRangeMonths: number;
  confidenceThreshold: number;
  requestDelayMs: number;
  maxRetries: number;
  chunkSizeTokens: number;
}

export interface ScanOptions {
  province?: string;
  limit?: number;
  retryFailed?: boolean;
  dryRun?: boolean;
  municipalityIds?: string[];
}

export interface ScanSummary {
  municipalitiesScanned: number;
  rfpsDetected: number;
  rfpsCreated: number;
  organizationsCreated: number;
  errors: number;
  topProvinces: Array<{ province: string; count: number }>;
  duration: number;
}

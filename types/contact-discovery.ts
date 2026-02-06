export interface DiscoveredContact {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  email: string | null;
  linkedin_url: string | null;
  confidence: number;
  source_hint: string | null;
}

export interface ContactDiscoveryRequest {
  roles: string[];
  max_results?: number;
}

export interface ContactDiscoveryResult {
  contacts: DiscoveredContact[];
  notes?: string;
}

export interface AddDiscoveredContactsRequest {
  contacts: {
    first_name: string;
    last_name: string;
    email?: string;
    job_title?: string;
    linkedin_url?: string;
  }[];
}

// Bulk contact discovery types
export interface OrganizationDiscoveryResult {
  organizationId: string;
  organizationName: string;
  status: 'pending' | 'discovering' | 'success' | 'failed';
  contacts: DiscoveredContact[];
  error?: string;
}

export interface BulkDiscoveryProgress {
  status: 'idle' | 'discovering' | 'completed' | 'cancelled';
  current: number;
  total: number;
  completed: number;
  failed: number;
  results: OrganizationDiscoveryResult[];
  currentOrgName?: string;
}

export type BulkContactSelection = Record<string, Set<string>>;

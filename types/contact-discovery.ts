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

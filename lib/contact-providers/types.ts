export interface ContactSearchParams {
  organizationName: string;
  domain?: string;
  roles: string[];
  maxResults?: number;
}

export interface DiscoveredContact {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  title: string | null;
  linkedinUrl: string | null;
  phone: string | null;
  confidence: number;
  source: string;
}

export interface ContactProvider {
  name: string;
  displayName: string;
  priority: number;
  costPerContact: number;

  searchContacts(params: ContactSearchParams): Promise<DiscoveredContact[]>;
  isConfigured(): boolean;
  checkCredits?(): Promise<number | null>;
}

export interface ProviderConfig {
  name: string;
  enabled: boolean;
  priority: number;
  apiKey?: string;
}

export interface WaterfallConfig {
  providers: ProviderConfig[];
  stopOnFirstResult: boolean;
  minConfidence: number;
}

export interface WaterfallResult {
  contacts: DiscoveredContact[];
  providerUsed: string | null;
  providersAttempted: string[];
  errors: { provider: string; error: string }[];
}

export interface ContactProviderSettings {
  providers: {
    leadmagic?: {
      enabled: boolean;
      priority: number;
      apiKey: string;
    };
    prospeo?: {
      enabled: boolean;
      priority: number;
      apiKey: string;
    };
    hunter?: {
      enabled: boolean;
      priority: number;
      apiKey: string;
    };
    apollo?: {
      enabled: boolean;
      priority: number;
      apiKey: string;
    };
  };
  waterfall: {
    stopOnFirstResult: boolean;
    minConfidence: number;
  };
}

export const DEFAULT_CONTACT_PROVIDER_SETTINGS: ContactProviderSettings = {
  providers: {},
  waterfall: {
    stopOnFirstResult: true,
    minConfidence: 0.5,
  },
};

export const PROVIDER_METADATA: Record<
  string,
  { displayName: string; costPerContact: number; defaultPriority: number }
> = {
  leadmagic: {
    displayName: 'LeadMagic',
    costPerContact: 0.01,
    defaultPriority: 1,
  },
  hunter: {
    displayName: 'Hunter.io',
    costPerContact: 0.05,
    defaultPriority: 2,
  },
  prospeo: {
    displayName: 'Prospeo',
    costPerContact: 0.04,
    defaultPriority: 3,
  },
  apollo: {
    displayName: 'Apollo.io',
    costPerContact: 0.05,
    defaultPriority: 4,
  },
};

import { BaseContactProvider } from './base-provider';
import { ContactSearchParams, DiscoveredContact } from './types';

const HUNTER_BASE_URL = 'https://api.hunter.io/v2';

interface HunterEmail {
  value: string;
  type: 'personal' | 'generic';
  confidence: number;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  department: string | null;
  seniority: string | null;
  linkedin: string | null;
  twitter: string | null;
  phone_number: string | null;
  verification: {
    date: string;
    status: 'valid' | 'accept_all' | 'unknown';
  };
}

interface HunterDomainSearchResponse {
  data?: {
    domain: string;
    organization: string;
    emails: HunterEmail[];
  };
  meta?: {
    results: number;
    limit: number;
    offset: number;
  };
  errors?: { id: string; code: number; details: string }[];
}

interface HunterAccountResponse {
  data?: {
    requests: {
      searches: {
        available: number;
        used: number;
      };
    };
  };
  errors?: { id: string; code: number; details: string }[];
}

export class HunterProvider extends BaseContactProvider {
  name = 'hunter';
  displayName = 'Hunter.io';
  priority = 2;
  costPerContact = 0.05;

  async checkCredits(): Promise<number | null> {
    try {
      const response = await fetch(`${HUNTER_BASE_URL}/account?api_key=${this.apiKey}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data: HunterAccountResponse = await response.json();
      return data.data?.requests?.searches?.available ?? null;
    } catch {
      return null;
    }
  }

  async searchContacts(params: ContactSearchParams): Promise<DiscoveredContact[]> {
    const domain = params.domain || this.extractDomainFromUrl(params.organizationName);

    if (!domain) {
      console.warn('Hunter requires a domain to search');
      return [];
    }

    const queryParams = new URLSearchParams({
      domain,
      api_key: this.apiKey,
      limit: String(params.maxResults || 10),
      type: 'personal', // Only get personal emails, not generic
    });

    // Add seniority filter for executive-level roles
    const executiveKeywords = ['ceo', 'cto', 'cfo', 'coo', 'vp', 'vice president', 'director', 'head'];
    const hasExecutiveRoles = params.roles.some((role) =>
      executiveKeywords.some((kw) => role.toLowerCase().includes(kw))
    );
    if (hasExecutiveRoles) {
      queryParams.set('seniority', 'executive,senior');
    }

    const response = await fetch(`${HUNTER_BASE_URL}/domain-search?${queryParams}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Hunter rate limit exceeded');
      }
      const errorData = await response.json().catch(() => ({}));
      console.error('Hunter API error:', response.status, errorData);
      throw new Error(`Hunter API error: ${response.status}`);
    }

    const data: HunterDomainSearchResponse = await response.json();

    console.log('Hunter response:', {
      domain,
      totalEmails: data.data?.emails?.length ?? 0,
      errors: data.errors,
    });

    if (data.errors || !data.data?.emails) {
      return [];
    }

    // Filter by roles client-side since job_titles param can cause 400 errors
    const emails = data.data.emails.filter((email) => email.type === 'personal');

    console.log('Hunter personal emails:', emails.length, 'roles:', params.roles);

    // If roles are specified, filter to matching positions
    // But if no matches found, return all personal emails (user can filter manually)
    let filteredEmails = emails;
    if (params.roles.length > 0) {
      const matched = emails.filter((email) => this.matchesTitle(email.position, params.roles));
      if (matched.length > 0) {
        filteredEmails = matched;
      }
      console.log('Hunter matched by role:', matched.length);
    }

    return filteredEmails.slice(0, params.maxResults || 10).map((email) => ({
      id: this.generateId(),
      name: this.buildFullName(email.first_name, email.last_name),
      firstName: email.first_name,
      lastName: email.last_name,
      email: email.value,
      title: email.position,
      linkedinUrl: email.linkedin ? `https://linkedin.com/in/${email.linkedin}` : null,
      phone: email.phone_number,
      confidence: this.normalizeConfidence(email.confidence, 100),
      source: this.name,
    }));
  }
}

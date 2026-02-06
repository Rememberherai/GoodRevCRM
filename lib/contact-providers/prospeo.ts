import { BaseContactProvider } from './base-provider';
import { ContactSearchParams, DiscoveredContact } from './types';

const PROSPEO_BASE_URL = 'https://api.prospeo.io';

interface ProspeoPersonResult {
  person: {
    person_id?: string;
    first_name?: string;
    last_name?: string;
    full_name?: string;
    linkedin_url?: string;
    headline?: string;
    current_job_title?: string;
    country?: string;
    city?: string;
  };
  company?: {
    company_id?: string;
    name?: string;
    website?: string;
    industry?: string;
  };
}

interface ProspeoSearchResponse {
  error?: boolean;
  error_code?: string;
  results?: ProspeoPersonResult[];
  pagination?: {
    current_page: number;
    per_page: number;
    total_page: number;
    total_count: number;
  };
}

interface ProspeoEnrichResponse {
  error?: boolean;
  email?: {
    email?: string;
    type?: string;
    status?: string;
  };
  person?: {
    first_name?: string;
    last_name?: string;
    linkedin_url?: string;
  };
}

export class ProspeoProvider extends BaseContactProvider {
  name = 'prospeo';
  displayName = 'Prospeo';
  priority = 3;
  costPerContact = 0.04;

  async searchContacts(params: ContactSearchParams): Promise<DiscoveredContact[]> {
    const domain = params.domain || this.extractDomainFromUrl(params.organizationName);

    if (!domain) {
      console.warn('Prospeo requires a domain to search');
      return [];
    }

    const filters: Record<string, unknown> = {
      company_websites: { include: [domain] },
    };

    // Add job title filter
    if (params.roles.length > 0) {
      filters.person_job_title = { include: params.roles };
    }

    const response = await fetch(`${PROSPEO_BASE_URL}/search-person`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-KEY': this.apiKey,
      },
      body: JSON.stringify({
        page: 1,
        filters,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Prospeo rate limit exceeded');
      }
      throw new Error(`Prospeo API error: ${response.status}`);
    }

    const data: ProspeoSearchResponse = await response.json();

    if (data.error || !data.results) {
      return [];
    }

    const contacts: DiscoveredContact[] = [];
    const maxResults = params.maxResults || 10;

    for (const result of data.results.slice(0, maxResults)) {
      const person = result.person;

      // Try to enrich to get email
      let email: string | null = null;
      if (person.person_id) {
        try {
          email = await this.enrichPerson(person.person_id);
        } catch {
          // Continue without email
        }
      }

      contacts.push({
        id: this.generateId(),
        name: person.full_name || this.buildFullName(person.first_name || null, person.last_name || null),
        firstName: person.first_name || null,
        lastName: person.last_name || null,
        email,
        title: person.current_job_title || person.headline || null,
        linkedinUrl: person.linkedin_url || null,
        phone: null,
        confidence: email ? 0.85 : 0.7,
        source: this.name,
      });
    }

    return contacts;
  }

  private async enrichPerson(personId: string): Promise<string | null> {
    const response = await fetch(`${PROSPEO_BASE_URL}/enrich-person`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-KEY': this.apiKey,
      },
      body: JSON.stringify({
        only_verified_email: true,
        enrich_mobile: false,
        data: { person_id: personId },
      }),
    });

    if (!response.ok) return null;

    const data: ProspeoEnrichResponse = await response.json();

    if (data.error || !data.email?.email) return null;

    return data.email.email;
  }
}

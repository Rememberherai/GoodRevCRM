import { BaseContactProvider } from './base-provider';
import { ContactSearchParams, DiscoveredContact } from './types';

const APOLLO_BASE_URL = 'https://api.apollo.io/api/v1';

interface ApolloPerson {
  id: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  headline?: string;
  linkedin_url?: string;
  organization?: {
    name?: string;
    website_url?: string;
  };
}

interface ApolloSearchResponse {
  people?: ApolloPerson[];
  total_entries?: number;
}

interface ApolloEnrichResponse {
  person?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    email_status?: string;
    title?: string;
    linkedin_url?: string;
    phone_numbers?: {
      raw_number: string;
      sanitized_number: string;
      status: string;
    }[];
  };
}

export class ApolloProvider extends BaseContactProvider {
  name = 'apollo';
  displayName = 'Apollo.io';
  priority = 4;
  costPerContact = 0.05;

  async searchContacts(params: ContactSearchParams): Promise<DiscoveredContact[]> {
    const domain = params.domain || this.extractDomainFromUrl(params.organizationName);

    // Build query params for people search
    const queryParams = new URLSearchParams();

    // Add titles filter
    params.roles.forEach((role) => {
      queryParams.append('person_titles[]', role);
    });

    // Add domain filter
    if (domain) {
      queryParams.set('q_organization_domains', domain);
    } else {
      queryParams.set('q_organization_name', params.organizationName);
    }

    queryParams.set('per_page', String(params.maxResults || 10));

    const response = await fetch(`${APOLLO_BASE_URL}/mixed_people/api_search?${queryParams}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Apollo rate limit exceeded');
      }
      throw new Error(`Apollo API error: ${response.status}`);
    }

    const data: ApolloSearchResponse = await response.json();

    if (!data.people || data.people.length === 0) {
      return [];
    }

    const contacts: DiscoveredContact[] = [];

    for (const person of data.people.slice(0, params.maxResults || 10)) {
      // Try to enrich to get email
      let email: string | null = null;
      let phone: string | null = null;

      if (person.first_name && person.last_name && domain) {
        try {
          const enriched = await this.enrichPerson(
            person.first_name,
            person.last_name,
            domain
          );
          email = enriched.email;
          phone = enriched.phone;
        } catch {
          // Continue without email
        }
      }

      contacts.push({
        id: this.generateId(),
        name: this.buildFullName(person.first_name || null, person.last_name || null),
        firstName: person.first_name || null,
        lastName: person.last_name || null,
        email,
        title: person.title || person.headline || null,
        linkedinUrl: person.linkedin_url || null,
        phone,
        confidence: email ? 0.85 : 0.6,
        source: this.name,
      });
    }

    return contacts;
  }

  private async enrichPerson(
    firstName: string,
    lastName: string,
    domain: string
  ): Promise<{ email: string | null; phone: string | null }> {
    const queryParams = new URLSearchParams({
      first_name: firstName,
      last_name: lastName,
      domain,
      reveal_personal_emails: 'false',
    });

    const response = await fetch(`${APOLLO_BASE_URL}/people/match?${queryParams}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      return { email: null, phone: null };
    }

    const data: ApolloEnrichResponse = await response.json();

    return {
      email: data.person?.email || null,
      phone: data.person?.phone_numbers?.[0]?.sanitized_number || null,
    };
  }
}

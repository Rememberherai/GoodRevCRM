import { BaseContactProvider } from './base-provider';
import { ContactSearchParams, DiscoveredContact } from './types';

const LEADMAGIC_BASE_URL = 'https://api.leadmagic.io';

interface LeadMagicRoleFinderResponse {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  profile_url?: string;
  job_title?: string;
  company_name?: string;
  company_website?: string;
  credits_consumed?: number;
  message?: string;
  error?: string;
}

interface LeadMagicEmployee {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  profile_url?: string;
  job_title?: string;
  location?: string;
}

interface LeadMagicEmployeeFinderResponse {
  employees?: LeadMagicEmployee[];
  total_count?: number;
  credits_consumed?: number;
  message?: string;
  error?: string;
}

interface LeadMagicCreditsResponse {
  credits?: number;
  error?: string;
}

export class LeadMagicProvider extends BaseContactProvider {
  name = 'leadmagic';
  displayName = 'LeadMagic';
  priority = 1;
  costPerContact = 0.01;

  async searchContacts(params: ContactSearchParams): Promise<DiscoveredContact[]> {
    const contacts: DiscoveredContact[] = [];
    const domain = params.domain || this.extractDomainFromUrl(params.organizationName);

    // Try Role Finder for each role
    for (const role of params.roles) {
      try {
        const result = await this.findByRole(params.organizationName, domain, role);
        if (result) {
          contacts.push(result);
          if (params.maxResults && contacts.length >= params.maxResults) {
            break;
          }
        }
      } catch (error) {
        console.error(`LeadMagic role finder error for ${role}:`, error);
      }
    }

    // If we didn't find enough contacts, try Employee Finder
    if (contacts.length < (params.maxResults || 10)) {
      try {
        const employees = await this.findEmployees(
          params.organizationName,
          domain,
          params.roles,
          (params.maxResults || 10) - contacts.length
        );
        contacts.push(...employees);
      } catch (error) {
        console.error('LeadMagic employee finder error:', error);
      }
    }

    return contacts.slice(0, params.maxResults || 10);
  }

  private async findByRole(
    companyName: string,
    domain: string | null,
    jobTitle: string
  ): Promise<DiscoveredContact | null> {
    const body: Record<string, string> = {
      job_title: jobTitle,
    };

    if (domain) {
      body.company_domain = domain;
    } else {
      body.company_name = companyName;
    }

    const response = await fetch(`${LEADMAGIC_BASE_URL}/v1/people/role-finder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`LeadMagic API error: ${response.status}`);
    }

    const data: LeadMagicRoleFinderResponse = await response.json();

    if (data.error || !data.first_name) {
      return null;
    }

    return {
      id: this.generateId(),
      name: data.full_name || this.buildFullName(data.first_name || null, data.last_name || null),
      firstName: data.first_name || null,
      lastName: data.last_name || null,
      email: null, // Role finder doesn't return email
      title: data.job_title || null,
      linkedinUrl: data.profile_url || null,
      phone: null,
      confidence: 0.9, // High confidence since it's a direct role match
      source: this.name,
    };
  }

  private async findEmployees(
    companyName: string,
    domain: string | null,
    roles: string[],
    limit: number
  ): Promise<DiscoveredContact[]> {
    const body: Record<string, string | number> = {
      limit: Math.min(limit * 2, 50), // Fetch more to filter by role
    };

    if (domain) {
      body.company_domain = domain;
    } else {
      body.company_name = companyName;
    }

    const response = await fetch(`${LEADMAGIC_BASE_URL}/v1/people/employee-finder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`LeadMagic API error: ${response.status}`);
    }

    const data: LeadMagicEmployeeFinderResponse = await response.json();

    if (data.error || !data.employees) {
      return [];
    }

    // Filter employees by matching roles
    const matchingEmployees = data.employees.filter((emp) =>
      this.matchesTitle(emp.job_title || null, roles)
    );

    return matchingEmployees.slice(0, limit).map((emp) => ({
      id: this.generateId(),
      name: emp.full_name || this.buildFullName(emp.first_name || null, emp.last_name || null),
      firstName: emp.first_name || null,
      lastName: emp.last_name || null,
      email: null,
      title: emp.job_title || null,
      linkedinUrl: emp.profile_url || null,
      phone: null,
      confidence: 0.7, // Lower confidence since it's from employee list
      source: this.name,
    }));
  }

  async checkCredits(): Promise<number | null> {
    try {
      const response = await fetch(`${LEADMAGIC_BASE_URL}/credits`, {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey,
        },
      });

      if (!response.ok) return null;

      const data: LeadMagicCreditsResponse = await response.json();
      return data.credits ?? null;
    } catch {
      return null;
    }
  }
}

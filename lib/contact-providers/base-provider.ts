import { ContactProvider, ContactSearchParams, DiscoveredContact } from './types';

export abstract class BaseContactProvider implements ContactProvider {
  abstract name: string;
  abstract displayName: string;
  abstract priority: number;
  abstract costPerContact: number;

  protected apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  abstract searchContacts(params: ContactSearchParams): Promise<DiscoveredContact[]>;

  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  async checkCredits(): Promise<number | null> {
    return null;
  }

  protected generateId(): string {
    return crypto.randomUUID();
  }

  protected normalizeConfidence(score: number, max: number = 100): number {
    return Math.min(1, Math.max(0, score / max));
  }

  protected buildFullName(firstName: string | null, lastName: string | null): string {
    return [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';
  }

  protected extractDomainFromUrl(url: string | undefined): string | null {
    if (!url) return null;
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }

  protected matchesTitle(actualTitle: string | null, searchRoles: string[]): boolean {
    if (!actualTitle) return false;
    const normalizedActual = actualTitle.toLowerCase();
    return searchRoles.some((role) => {
      const normalizedRole = role.toLowerCase();
      return (
        normalizedActual.includes(normalizedRole) ||
        normalizedRole.includes(normalizedActual)
      );
    });
  }
}

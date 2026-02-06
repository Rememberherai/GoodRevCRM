import { decrypt } from '@/lib/encryption';
import { createClient } from '@/lib/supabase/server';
import { LeadMagicProvider } from './leadmagic';
import { ProspeoProvider } from './prospeo';
import { HunterProvider } from './hunter';
import { ApolloProvider } from './apollo';
import {
  ContactProvider,
  ContactSearchParams,
  ContactProviderSettings,
  DEFAULT_CONTACT_PROVIDER_SETTINGS,
  DiscoveredContact,
  WaterfallResult,
} from './types';

type ProviderName = 'leadmagic' | 'prospeo' | 'hunter' | 'apollo';

function createProvider(name: ProviderName, apiKey: string): ContactProvider {
  switch (name) {
    case 'leadmagic':
      return new LeadMagicProvider(apiKey);
    case 'prospeo':
      return new ProspeoProvider(apiKey);
    case 'hunter':
      return new HunterProvider(apiKey);
    case 'apollo':
      return new ApolloProvider(apiKey);
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}

export async function getProjectContactProviderSettings(
  projectId: string
): Promise<ContactProviderSettings> {
  const supabase = await createClient();

  const { data: project, error } = await supabase
    .from('projects')
    .select('settings')
    .eq('id', projectId)
    .single();

  if (error || !project?.settings) {
    return DEFAULT_CONTACT_PROVIDER_SETTINGS;
  }

  const settings = project.settings as Record<string, unknown>;
  const contactProviders = settings.contact_providers as ContactProviderSettings | undefined;

  return contactProviders || DEFAULT_CONTACT_PROVIDER_SETTINGS;
}

export async function searchContactsWaterfall(
  params: ContactSearchParams,
  projectId: string
): Promise<WaterfallResult> {
  const result: WaterfallResult = {
    contacts: [],
    providerUsed: null,
    providersAttempted: [],
    errors: [],
  };

  const settings = await getProjectContactProviderSettings(projectId);

  // Build list of enabled providers with their API keys
  const enabledProviders: { name: ProviderName; priority: number; apiKey: string }[] = [];

  for (const [name, config] of Object.entries(settings.providers)) {
    if (config?.enabled && config?.apiKey) {
      enabledProviders.push({
        name: name as ProviderName,
        priority: config.priority,
        apiKey: config.apiKey,
      });
    }
  }

  // Sort by priority (lower = try first)
  enabledProviders.sort((a, b) => a.priority - b.priority);

  if (enabledProviders.length === 0) {
    return result;
  }

  for (const providerConfig of enabledProviders) {
    result.providersAttempted.push(providerConfig.name);

    try {
      // Decrypt API key
      const apiKey = decrypt(providerConfig.apiKey);
      const provider = createProvider(providerConfig.name, apiKey);

      if (!provider.isConfigured()) {
        continue;
      }

      const contacts = await provider.searchContacts(params);

      // Filter by minimum confidence
      const qualified = contacts.filter(
        (c) => c.confidence >= settings.waterfall.minConfidence
      );

      if (qualified.length > 0) {
        result.contacts = qualified;
        result.providerUsed = providerConfig.name;

        if (settings.waterfall.stopOnFirstResult) {
          break;
        }
      }
    } catch (error) {
      result.errors.push({
        provider: providerConfig.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // If stopOnFirstResult is false, deduplicate contacts across providers
  if (!settings.waterfall.stopOnFirstResult && result.contacts.length > 0) {
    result.contacts = deduplicateContacts(result.contacts);
  }

  return result;
}

function deduplicateContacts(contacts: DiscoveredContact[]): DiscoveredContact[] {
  const seen = new Map<string, DiscoveredContact>();

  for (const contact of contacts) {
    // Create a key based on email or LinkedIn URL or name
    const key =
      contact.email?.toLowerCase() ||
      contact.linkedinUrl?.toLowerCase() ||
      `${contact.firstName?.toLowerCase()}-${contact.lastName?.toLowerCase()}`;

    if (!key) {
      seen.set(contact.id, contact);
      continue;
    }

    const existing = seen.get(key);
    if (!existing || contact.confidence > existing.confidence) {
      seen.set(key, contact);
    }
  }

  return Array.from(seen.values());
}

export async function checkProviderCredits(
  projectId: string
): Promise<Record<string, number | null>> {
  const settings = await getProjectContactProviderSettings(projectId);
  const credits: Record<string, number | null> = {};

  for (const [name, config] of Object.entries(settings.providers)) {
    if (config?.enabled && config?.apiKey) {
      try {
        const apiKey = decrypt(config.apiKey);
        const provider = createProvider(name as ProviderName, apiKey);
        const checkCredits = provider.checkCredits;
        if (checkCredits) {
          credits[name] = await checkCredits.call(provider);
        } else {
          credits[name] = null;
        }
      } catch {
        credits[name] = null;
      }
    }
  }

  return credits;
}

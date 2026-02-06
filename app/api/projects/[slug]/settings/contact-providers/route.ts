import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { encrypt, decrypt, maskApiKey, isEncrypted } from '@/lib/encryption';
import {
  ContactProviderSettings,
  DEFAULT_CONTACT_PROVIDER_SETTINGS,
  PROVIDER_METADATA,
} from '@/lib/contact-providers/types';
import { LeadMagicProvider } from '@/lib/contact-providers/leadmagic';
import { HunterProvider } from '@/lib/contact-providers/hunter';
import { ProspeoProvider } from '@/lib/contact-providers/prospeo';
import { ApolloProvider } from '@/lib/contact-providers/apollo';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const providerConfigSchema = z.object({
  enabled: z.boolean(),
  priority: z.number().min(1).max(10),
  apiKey: z.string().optional(),
});

const updateSettingsSchema = z.object({
  providers: z
    .record(z.string(), providerConfigSchema)
    .optional(),
  waterfall: z
    .object({
      stopOnFirstResult: z.boolean(),
      minConfidence: z.number().min(0).max(1),
    })
    .optional(),
});

// GET /api/projects/[slug]/settings/contact-providers - Get contact provider settings
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, settings')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const settings = (project.settings as Record<string, unknown>)?.contact_providers as
      | ContactProviderSettings
      | undefined;

    if (!settings) {
      return NextResponse.json({
        providers: {},
        waterfall: DEFAULT_CONTACT_PROVIDER_SETTINGS.waterfall,
      });
    }

    // Mask API keys and check credits for enabled providers
    const maskedProviders: Record<
      string,
      { enabled: boolean; priority: number; apiKeyMasked: string; credits: number | null }
    > = {};

    for (const [name, config] of Object.entries(settings.providers)) {
      if (config) {
        let credits: number | null = null;

        // Try to get credits if enabled and has API key
        if (config.enabled && config.apiKey) {
          try {
            const decryptedKey = isEncrypted(config.apiKey)
              ? decrypt(config.apiKey)
              : config.apiKey;
            const provider = createProvider(name, decryptedKey);
            credits = await provider.checkCredits();
          } catch {
            // Ignore errors checking credits
          }
        }

        maskedProviders[name] = {
          enabled: config.enabled,
          priority: config.priority,
          apiKeyMasked: config.apiKey
            ? maskApiKey(isEncrypted(config.apiKey) ? 'configured' : config.apiKey)
            : '',
          credits,
        };
      }
    }

    return NextResponse.json({
      providers: maskedProviders,
      waterfall: settings.waterfall || DEFAULT_CONTACT_PROVIDER_SETTINGS.waterfall,
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/settings/contact-providers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/settings/contact-providers - Update contact provider settings
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, settings, owner_id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user has permission (owner or admin)
    const { data: membership } = await supabase
      .from('project_memberships')
      .select('role')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single();

    const isOwner = project.owner_id === user.id;
    const memberRole = (membership as { role?: string } | null)?.role;
    const isAdmin = memberRole === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = updateSettingsSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { providers, waterfall } = validationResult.data;

    // Get existing settings
    const existingSettings = (project.settings as Record<string, unknown>) || {};
    const existingContactProviders = (existingSettings.contact_providers as ContactProviderSettings) || {
      providers: {},
      waterfall: DEFAULT_CONTACT_PROVIDER_SETTINGS.waterfall,
    };

    // Update providers
    if (providers) {
      for (const [name, config] of Object.entries(providers)) {
        if (!PROVIDER_METADATA[name]) continue;

        const existingProvider = existingContactProviders.providers[
          name as keyof typeof existingContactProviders.providers
        ];

        const updatedProvider = {
          enabled: config.enabled,
          priority: config.priority,
          // Keep existing encrypted key if no new key provided
          apiKey: config.apiKey
            ? encrypt(config.apiKey)
            : existingProvider?.apiKey || '',
        };

        (existingContactProviders.providers as Record<string, typeof updatedProvider>)[name] =
          updatedProvider;
      }
    }

    // Update waterfall settings
    if (waterfall) {
      existingContactProviders.waterfall = waterfall;
    }

    // Save to database
    const updatedSettings = {
      ...existingSettings,
      contact_providers: JSON.parse(JSON.stringify(existingContactProviders)),
    };

    const { error: updateError } = await supabase
      .from('projects')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ settings: updatedSettings as any })
      .eq('id', project.id);

    if (updateError) {
      console.error('Failed to update project settings:', updateError);
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/settings/contact-providers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function createProvider(name: string, apiKey: string) {
  switch (name) {
    case 'leadmagic':
      return new LeadMagicProvider(apiKey);
    case 'hunter':
      return new HunterProvider(apiKey);
    case 'prospeo':
      return new ProspeoProvider(apiKey);
    case 'apollo':
      return new ApolloProvider(apiKey);
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}

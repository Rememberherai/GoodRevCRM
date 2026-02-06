import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { decrypt, isEncrypted } from '@/lib/encryption';
import { ContactProviderSettings } from '@/lib/contact-providers/types';
import { LeadMagicProvider } from '@/lib/contact-providers/leadmagic';
import { HunterProvider } from '@/lib/contact-providers/hunter';
import { ProspeoProvider } from '@/lib/contact-providers/prospeo';
import { ApolloProvider } from '@/lib/contact-providers/apollo';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// POST /api/projects/[slug]/settings/contact-providers/test?provider=leadmagic - Test provider connection
// Accepts optional { apiKey } in body to test unsaved keys
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const { searchParams } = new URL(request.url);
    const providerName = searchParams.get('provider');

    if (!providerName) {
      return NextResponse.json({ error: 'Provider name required' }, { status: 400 });
    }

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

    // Check if API key was provided in request body (for testing unsaved keys)
    let apiKey: string | null = null;
    try {
      const body = await request.json();
      if (body?.apiKey && typeof body.apiKey === 'string') {
        apiKey = body.apiKey;
      }
    } catch {
      // No body or invalid JSON, will try to get from saved settings
    }

    // If no API key in body, get from saved settings
    if (!apiKey) {
      const settings = (project.settings as Record<string, unknown>)?.contact_providers as
        | ContactProviderSettings
        | undefined;

      if (!settings) {
        return NextResponse.json({ error: 'No provider settings configured' }, { status: 400 });
      }

      const providerConfig =
        settings.providers[providerName as keyof typeof settings.providers];

      if (!providerConfig?.apiKey) {
        return NextResponse.json({ error: 'Provider not configured' }, { status: 400 });
      }

      // Decrypt API key
      apiKey = isEncrypted(providerConfig.apiKey)
        ? decrypt(providerConfig.apiKey)
        : providerConfig.apiKey;
    }

    // Create provider and test connection
    const provider = createProvider(providerName, apiKey);

    if (!provider.isConfigured()) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 400 });
    }

    // Try to check credits as a connection test
    const credits = await provider.checkCredits();

    return NextResponse.json({
      success: true,
      credits,
    });
  } catch (error) {
    console.error('Error testing provider connection:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Connection test failed' },
      { status: 500 }
    );
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

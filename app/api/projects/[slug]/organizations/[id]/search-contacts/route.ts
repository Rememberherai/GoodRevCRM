import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { contactDiscoverySchema } from '@/lib/validators/contact-discovery';
import { searchContactsWaterfall, getProjectContactProviderSettings } from '@/lib/contact-providers';
import type { DiscoveredContact as TypedDiscoveredContact } from '@/types/contact-discovery';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// POST /api/projects/[slug]/organizations/[id]/search-contacts - Search contacts using waterfall providers
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id: organizationId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project ID from slug
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get organization
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, domain, website, industry')
      .eq('id', organizationId)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();

    if (orgError || !organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = contactDiscoverySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { roles, max_results } = validationResult.data;

    // Check if any providers are configured
    const settings = await getProjectContactProviderSettings(project.id);
    const hasEnabledProviders = Object.values(settings.providers).some(
      (p) => p?.enabled && p?.apiKey
    );

    if (!hasEnabledProviders) {
      return NextResponse.json(
        {
          error: 'No contact discovery providers configured',
          message: 'Please configure at least one provider in project settings',
        },
        { status: 400 }
      );
    }

    // Extract domain from organization
    const domain =
      organization.domain ||
      (organization.website
        ? new URL(
            organization.website.startsWith('http')
              ? organization.website
              : `https://${organization.website}`
          ).hostname.replace(/^www\./, '')
        : null);

    // Search contacts using waterfall
    const result = await searchContactsWaterfall(
      {
        organizationName: organization.name,
        domain: domain || undefined,
        roles,
        maxResults: max_results,
      },
      project.id
    );

    // Map to expected response format
    const contacts: TypedDiscoveredContact[] = result.contacts.map((contact, index) => ({
      id: contact.id || `search-${index}`,
      name: contact.name,
      first_name: contact.firstName,
      last_name: contact.lastName,
      title: contact.title,
      email: contact.email,
      linkedin_url: contact.linkedinUrl,
      confidence: contact.confidence,
      source_hint: contact.source,
    }));

    return NextResponse.json({
      contacts,
      organization: {
        id: organization.id,
        name: organization.name,
      },
      roles_searched: roles,
      provider_used: result.providerUsed,
      providers_attempted: result.providersAttempted,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/organizations/[id]/search-contacts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

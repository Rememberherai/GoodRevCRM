import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { contactDiscoverySchema } from '@/lib/validators/contact-discovery';
import { buildContactDiscoveryPrompt } from '@/lib/openrouter/prompts';
import { getOpenRouterClient } from '@/lib/openrouter/client';
import type { DiscoveredContact, ContactDiscoveryResult } from '@/types/contact-discovery';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// Schema for parsing AI response
const discoveredContactSchema = z.object({
  id: z.string(),
  name: z.string(),
  first_name: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
  last_name: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
  title: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
  email: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
  linkedin_url: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
  confidence: z.number().min(0).max(1),
  source_hint: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
});

const contactDiscoveryResultSchema = z.object({
  contacts: z.array(discoveredContactSchema),
  notes: z.string().optional(),
});

// POST /api/projects/[slug]/organizations/[id]/discover-contacts - Discover contacts at organization
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

    // Build prompt
    const prompt = buildContactDiscoveryPrompt(organization, roles, max_results);

    // Call OpenRouter
    const client = getOpenRouterClient();
    const result = await client.completeJson<ContactDiscoveryResult>(
      prompt,
      contactDiscoveryResultSchema,
      {
        temperature: 0.3, // Lower temperature for more consistent results
        maxTokens: 4096,
      }
    );

    // Process contacts - split names if first_name/last_name not provided
    const processedContacts: DiscoveredContact[] = result.contacts.map((contact, index) => {
      let firstName = contact.first_name;
      let lastName = contact.last_name;

      // If AI didn't provide first/last name, try to split from full name
      if ((!firstName || !lastName) && contact.name) {
        const nameParts = contact.name.trim().split(/\s+/);
        if (nameParts.length >= 2) {
          firstName = firstName ?? nameParts[0] ?? null;
          lastName = lastName ?? nameParts.slice(1).join(' ') ?? null;
        } else if (nameParts.length === 1) {
          firstName = firstName ?? nameParts[0] ?? null;
        }
      }

      return {
        ...contact,
        id: contact.id || `discovered-${index}`,
        first_name: firstName,
        last_name: lastName,
      };
    });

    return NextResponse.json({
      contacts: processedContacts,
      notes: result.notes,
      organization: {
        id: organization.id,
        name: organization.name,
      },
      roles_searched: roles,
    });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/organizations/[id]/discover-contacts:', error);

    if (error instanceof Error && error.name === 'OpenRouterError') {
      return NextResponse.json(
        { error: `AI service error: ${error.message}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

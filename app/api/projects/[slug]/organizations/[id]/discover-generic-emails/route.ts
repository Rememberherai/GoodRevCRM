import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildGenericEmailDiscoveryPrompt } from '@/lib/openrouter/prompts';
import { getProjectOpenRouterClient } from '@/lib/openrouter/client';
import { logAiUsage } from '@/lib/openrouter/usage';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// Schema for validating the request body
const requestSchema = z.object({
  departments: z
    .array(z.string())
    .min(1)
    .default(['Water/Wastewater', 'Public Works', 'General/Clerk']),
  max_results: z.number().min(1).max(10).default(3),
});

// Schema for parsing AI response
const genericEmailSchema = z.object({
  emails: z.array(
    z.object({
      email: z.string().email(),
      department_name: z.string(),
      confidence: z.number().min(0).max(1),
      source_hint: z
        .string()
        .nullish()
        .transform((v) => v ?? null),
    })
  ),
  discovered_domain: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
  discovered_website: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
  notes: z.string().optional(),
});

type GenericEmailResult = z.infer<typeof genericEmailSchema>;

// POST /api/projects/[slug]/organizations/[id]/discover-generic-emails
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

    // Get organization with address fields for context
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select(
        'id, name, domain, website, industry, address_city, address_state, address_country'
      )
      .eq('id', organizationId)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();

    if (orgError || !organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = requestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { departments, max_results } = validationResult.data;

    // Build prompt
    const prompt = buildGenericEmailDiscoveryPrompt(
      {
        name: organization.name,
        domain: organization.domain,
        website: organization.website,
        city: organization.address_city,
        state: organization.address_state,
        country: organization.address_country,
        industry: organization.industry,
      },
      departments,
      max_results
    );

    // Call OpenRouter
    const client = await getProjectOpenRouterClient(project.id);
    const aiResult = await client.completeJsonWithUsage<GenericEmailResult>(
      prompt,
      genericEmailSchema,
      {
        temperature: 0.2,
        maxTokens: 2048,
        webSearch: true,
      }
    );
    const result = aiResult.data;

    // Log AI usage
    await logAiUsage(supabase, {
      projectId: project.id,
      userId: user.id,
      feature: 'generic_email_discovery',
      model: aiResult.model,
      promptTokens: aiResult.usage?.prompt_tokens,
      completionTokens: aiResult.usage?.completion_tokens,
      totalTokens: aiResult.usage?.total_tokens,
      metadata: { organizationId, departments, max_results },
    });

    // Backfill organization domain/website if discovered and not already set
    if (result.discovered_domain || result.discovered_website) {
      const updates: Record<string, string> = {};
      if (result.discovered_domain && !organization.domain) {
        updates.domain = result.discovered_domain;
      }
      if (result.discovered_website && !organization.website) {
        updates.website = result.discovered_website;
      }
      if (Object.keys(updates).length > 0) {
        await supabase
          .from('organizations')
          .update(updates)
          .eq('id', organizationId);
      }
    }

    // Transform emails into DiscoveredContact-compatible format for the add-contacts API
    const contacts = result.emails.map((email, index) => ({
      id: `generic-${index}`,
      name: email.department_name,
      first_name: email.department_name,
      last_name: null,
      title: 'Department',
      email: email.email,
      linkedin_url: null,
      confidence: email.confidence,
      source_hint: email.source_hint ?? 'AI generic email discovery',
    }));

    return NextResponse.json({
      contacts,
      discovered_domain: result.discovered_domain,
      discovered_website: result.discovered_website,
      notes: result.notes,
      organization: {
        id: organization.id,
        name: organization.name,
      },
      departments_searched: departments,
    });
  } catch (error) {
    console.error(
      'Error in POST /api/projects/[slug]/organizations/[id]/discover-generic-emails:',
      error
    );

    if (error instanceof Error && error.name === 'OpenRouterError') {
      return NextResponse.json(
        { error: 'Generic email discovery service temporarily unavailable' },
        { status: 502 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

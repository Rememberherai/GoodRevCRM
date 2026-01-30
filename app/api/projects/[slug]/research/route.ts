import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { startResearchSchema, researchHistoryQuerySchema } from '@/lib/validators/research';
import { getOpenRouterClient, DEFAULT_MODEL } from '@/lib/openrouter/client';
import {
  organizationResearchSchema,
  personResearchSchema,
} from '@/lib/openrouter/structured-output';
import {
  buildOrganizationResearchPrompt,
  buildPersonResearchPrompt,
  getAIExtractableFields,
} from '@/lib/openrouter/prompts';
import type { CustomFieldDefinition, EntityType } from '@/types/custom-field';
import type { ResearchJob } from '@/types/research';
import type { OrganizationResearch, PersonResearch } from '@/lib/openrouter/structured-output';

// Type for research settings from DB
interface ResearchSettingsDB {
  id: string;
  project_id: string;
  entity_type: EntityType;
  system_prompt: string | null;
  user_prompt_template: string | null;
  model_id: string;
  temperature: number;
  max_tokens: number;
  default_confidence_threshold: number;
  auto_apply_high_confidence: boolean;
  high_confidence_threshold: number;
}

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/research - Get research history
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryResult = researchHistoryQuerySchema.safeParse({
      entity_type: searchParams.get('entity_type') ?? undefined,
      entity_id: searchParams.get('entity_id') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { entity_type, entity_id, status, limit = 50, offset = 0 } = queryResult.data;

    // Use type assertion since table isn't in generated types yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseQuery = supabase as any;

    let queryBuilder = supabaseQuery
      .from('research_jobs')
      .select('*')
      .eq('project_id', project.id);

    if (entity_type) {
      queryBuilder = queryBuilder.eq('entity_type', entity_type);
    }
    if (entity_id) {
      queryBuilder = queryBuilder.eq('entity_id', entity_id);
    }
    if (status) {
      queryBuilder = queryBuilder.eq('status', status);
    }

    const { data: jobs, error } = await queryBuilder
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching research jobs:', error);
      return NextResponse.json({ error: 'Failed to fetch research history' }, { status: 500 });
    }

    return NextResponse.json({
      jobs: (jobs ?? []) as ResearchJob[],
      pagination: {
        total: 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/research:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/research - Start a research job
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

    const body = await request.json();
    const validationResult = startResearchSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { entity_type, entity_id, include_custom_fields = true } = validationResult.data;

    // Fetch the entity to research
    type EntityData = {
      name?: string;
      domain?: string | null;
      website?: string | null;
      industry?: string | null;
      first_name?: string;
      last_name?: string;
      email?: string | null;
      job_title?: string | null;
      primary_organization_id?: string | null;
    };

    let entity: EntityData | null = null;
    let organizationName: string | undefined;

    if (entity_type === 'organization') {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', entity_id)
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }
      entity = data as EntityData;
    } else if (entity_type === 'person') {
      const { data, error } = await supabase
        .from('people')
        .select('*')
        .eq('id', entity_id)
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Person not found' }, { status: 404 });
      }
      entity = data as EntityData;

      // Get primary organization name if linked
      if (entity.primary_organization_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', entity.primary_organization_id)
          .single();
        organizationName = org?.name;
      }
    } else {
      return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 });
    }

    // Fetch custom fields if requested (only AI-extractable ones)
    let customFields: CustomFieldDefinition[] = [];
    if (include_custom_fields) {
      const { data: fields } = await supabase
        .from('custom_field_definitions')
        .select('*')
        .eq('project_id', project.id)
        .eq('entity_type', entity_type)
        .is('deleted_at', null);

      // Filter to only AI-extractable fields
      customFields = getAIExtractableFields((fields ?? []) as CustomFieldDefinition[]);
    }

    // Fetch research settings for this entity type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;
    const { data: researchSettingsData } = await supabaseAny
      .from('research_settings')
      .select('*')
      .eq('project_id', project.id)
      .eq('entity_type', entity_type)
      .single();

    const researchSettings = researchSettingsData as ResearchSettingsDB | null;

    // Use research settings or defaults
    const modelId = researchSettings?.model_id ?? DEFAULT_MODEL;
    const temperature = researchSettings?.temperature ?? 0.3;
    const maxTokens = researchSettings?.max_tokens ?? 4096;

    // Build the research prompt (with custom system/user prompts if configured)
    let prompt: string;
    let systemPrompt: string | undefined;

    if (researchSettings?.system_prompt) {
      systemPrompt = researchSettings.system_prompt;
    }

    if (entity_type === 'organization') {
      prompt = buildOrganizationResearchPrompt(
        {
          name: entity.name ?? '',
          domain: entity.domain ?? null,
          website: entity.website ?? null,
          industry: entity.industry ?? null,
        },
        customFields,
        researchSettings?.user_prompt_template ?? undefined
      );
    } else {
      prompt = buildPersonResearchPrompt(
        {
          first_name: entity.first_name ?? '',
          last_name: entity.last_name ?? '',
          email: entity.email ?? null,
          job_title: entity.job_title ?? null,
        },
        organizationName,
        customFields,
        researchSettings?.user_prompt_template ?? undefined
      );
    }

    // Create the research job record
    const { data: job, error: insertError } = await supabaseAny
      .from('research_jobs')
      .insert({
        project_id: project.id,
        entity_type,
        entity_id,
        status: 'running',
        prompt,
        created_by: user.id,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError || !job) {
      console.error('Error creating research job:', insertError);
      return NextResponse.json({ error: 'Failed to create research job' }, { status: 500 });
    }

    // Execute the research (async but we'll wait for it)
    try {
      const client = getOpenRouterClient();

      // Call the appropriate schema based on entity type
      // Use configured model and settings
      let result: OrganizationResearch | PersonResearch;
      if (entity_type === 'organization') {
        result = await client.completeJson(prompt, organizationResearchSchema, {
          model: modelId,
          temperature,
          maxTokens,
          systemPrompt,
        });
      } else {
        result = await client.completeJson(prompt, personResearchSchema, {
          model: modelId,
          temperature,
          maxTokens,
          systemPrompt,
        });
      }

      // Update the job with results
      const { data: updatedJob, error: updateError } = await supabaseAny
        .from('research_jobs')
        .update({
          status: 'completed',
          result,
          model_used: modelId,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating research job:', updateError);
      }

      return NextResponse.json({ job: updatedJob ?? { ...job, status: 'completed', result } });
    } catch (researchError) {
      // Update the job with error
      const errorMessage = researchError instanceof Error ? researchError.message : 'Research failed';

      await supabaseAny
        .from('research_jobs')
        .update({
          status: 'failed',
          error: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .select()
        .single();

      return NextResponse.json({ job: { ...job, status: 'failed', error: errorMessage } });
    }
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/research:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

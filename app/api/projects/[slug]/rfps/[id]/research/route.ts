import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { startRfpResearchSchema, rfpResearchResultSchema } from '@/lib/validators/rfp-research';
import { getOpenRouterClient } from '@/lib/openrouter/client';
import { logAiUsage } from '@/lib/openrouter/usage';
import { buildRfpResearchPrompt, RFP_RESEARCH_MODEL } from '@/lib/openrouter/rfp-research-prompts';
import type { RfpResearchContext, RfpResearchResult } from '@/types/rfp-research';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/rfps/[id]/research - Get research history for this RFP
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id: rfpId } = await context.params;
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

    // Verify RFP exists and belongs to project
    const { data: rfp, error: rfpError } = await supabase
      .from('rfps')
      .select('id')
      .eq('id', rfpId)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();

    if (rfpError || !rfp) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 });
    }

    // Fetch research history
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: results, error } = await (supabase as any)
      .from('rfp_research_results')
      .select('*')
      .eq('rfp_id', rfpId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching research results:', error);
      return NextResponse.json({ error: 'Failed to fetch research history' }, { status: 500 });
    }

    const typedResults = (results ?? []) as RfpResearchResult[];
    const latest = typedResults.find((r) => r.status === 'completed') ?? null;

    return NextResponse.json({
      results: typedResults,
      latest,
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/rfps/[id]/research:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/rfps/[id]/research - Start a new research job
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id: rfpId } = await context.params;
    const supabase = await createClient();
    const adminClient = createAdminClient();

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

    // Fetch RFP with organization
    interface RfpWithOrg {
      id: string;
      title: string;
      description: string | null;
      rfp_number: string | null;
      estimated_value: number | null;
      due_date: string | null;
      submission_method: string | null;
      organization: {
        id: string;
        name: string;
        domain: string | null;
        industry: string | null;
        description: string | null;
      } | null;
    }

    const { data: rfpData, error: rfpError } = await supabase
      .from('rfps')
      .select(
        `
        id,
        title,
        description,
        rfp_number,
        estimated_value,
        due_date,
        submission_method,
        organization:organizations(id, name, domain, industry, description)
      `
      )
      .eq('id', rfpId)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();

    if (rfpError || !rfpData) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 });
    }

    const rfp = rfpData as unknown as RfpWithOrg;

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const validationResult = startRfpResearchSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { additional_context } = validationResult.data;

    // Check if there's already a running research job
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: runningJobs } = await (supabase as any)
      .from('rfp_research_results')
      .select('id')
      .eq('rfp_id', rfpId)
      .eq('status', 'running');

    if (runningJobs && runningJobs.length > 0) {
      return NextResponse.json(
        { error: 'Research is already running for this RFP', jobId: runningJobs[0].id },
        { status: 409 }
      );
    }

    // Create the research job record with status 'running'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: job, error: insertError } = await (adminClient as any)
      .from('rfp_research_results')
      .insert({
        project_id: project.id,
        rfp_id: rfpId,
        status: 'running',
        started_at: new Date().toISOString(),
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError || !job) {
      console.error('Error creating research job:', insertError);
      return NextResponse.json({ error: 'Failed to create research job' }, { status: 500 });
    }

    // Build research context
    const org = rfp.organization;
    const researchContext: RfpResearchContext = {
      rfp: {
        id: rfp.id,
        title: rfp.title,
        description: rfp.description,
        rfp_number: rfp.rfp_number,
        estimated_value: rfp.estimated_value,
        due_date: rfp.due_date,
        submission_method: rfp.submission_method,
      },
      organization: org
        ? {
            name: org.name,
            domain: org.domain ?? null,
            industry: org.industry ?? null,
            description: org.description ?? null,
          }
        : null,
      additional_context,
    };

    // Execute research in background (fire and forget)
    executeResearch(job.id, researchContext, project.id, user.id, adminClient).catch((err) => {
      console.error('Background research execution failed:', err);
    });

    return NextResponse.json({
      job: job as RfpResearchResult,
      status: 'started',
    });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/rfps/[id]/research:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Extract JSON from response that may have extra text
function extractJson(content: string): string {
  // Find the first { and last } to extract the JSON object
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return content.substring(start, end + 1);
  }
  return content;
}

// Background research execution function
async function executeResearch(
  jobId: string,
  context: RfpResearchContext,
  projectId: string,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any
): Promise<void> {
  try {
    const client = getOpenRouterClient();
    const prompt = buildRfpResearchPrompt(context);

    console.log('[RFP Research] Starting research for job:', jobId);

    // Call the AI - use chat directly since Claude may add text after JSON
    const response = await client.chat(
      [{ role: 'user', content: prompt }],
      {
        model: RFP_RESEARCH_MODEL,
        temperature: 0.2,
        maxTokens: 8192,
        responseFormat: 'json_object',
      }
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in AI response');
    }

    console.log('[RFP Research] AI response received for job:', jobId);

    // Extract and parse JSON
    const jsonContent = extractJson(content);
    let parsedData: unknown;
    try {
      parsedData = JSON.parse(jsonContent);
    } catch {
      console.error('[RFP Research] JSON parse failed, content:', jsonContent.substring(0, 500));
      throw new Error('Failed to parse JSON from AI response');
    }

    // Validate against schema
    const validationResult = rfpResearchResultSchema.safeParse(parsedData);
    if (!validationResult.success) {
      console.error('[RFP Research] Schema validation failed:', validationResult.error.message);
      throw new Error(`Schema validation failed: ${validationResult.error.message}`);
    }

    const result = {
      data: validationResult.data,
      usage: response.usage ?? null,
      model: response.model,
    };

    // Log AI usage
    await logAiUsage(adminClient, {
      projectId,
      userId,
      feature: 'rfp_research',
      model: result.model,
      promptTokens: result.usage?.prompt_tokens,
      completionTokens: result.usage?.completion_tokens,
      totalTokens: result.usage?.total_tokens,
      metadata: { rfpId: context.rfp.id, jobId },
    });

    // Update the job with results
    const { error: updateError } = await adminClient
      .from('rfp_research_results')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        organization_profile: result.data.organization_profile ?? null,
        industry_context: result.data.industry_context ?? null,
        competitor_analysis: result.data.competitor_analysis ?? null,
        similar_contracts: result.data.similar_contracts ?? null,
        key_decision_makers: result.data.key_decision_makers ?? null,
        news_and_press: result.data.news_and_press ?? null,
        compliance_context: result.data.compliance_context ?? null,
        market_intelligence: result.data.market_intelligence ?? null,
        executive_summary: result.data.executive_summary,
        key_insights: result.data.key_insights,
        recommended_actions: result.data.recommended_actions,
        sources: result.data.sources,
        model_used: result.model,
        tokens_used: result.usage?.total_tokens ?? null,
      })
      .eq('id', jobId);

    if (updateError) {
      console.error('[RFP Research] Failed to update job with results:', updateError);
    } else {
      console.log('[RFP Research] Job completed successfully:', jobId);
    }
  } catch (err) {
    console.error('[RFP Research] Research execution failed:', err);

    // Update the job with error
    const errorMessage = err instanceof Error ? err.message : 'Research failed';
    await adminClient
      .from('rfp_research_results')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error: errorMessage,
      })
      .eq('id', jobId);
  }
}

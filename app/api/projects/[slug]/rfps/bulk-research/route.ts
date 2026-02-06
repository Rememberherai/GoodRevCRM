import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getOpenRouterClient } from '@/lib/openrouter/client';
import { logAiUsage } from '@/lib/openrouter/usage';
import { buildRfpResearchPrompt, RFP_RESEARCH_MODEL } from '@/lib/openrouter/rfp-research-prompts';
import { rfpResearchResultSchema } from '@/lib/validators/rfp-research';
import type { RfpResearchContext } from '@/types/rfp-research';

const bulkResearchSchema = z.object({
  rfp_ids: z.array(z.string().uuid()).min(1).max(20),
  additional_context: z.string().max(2000).optional(),
});

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// POST /api/projects/[slug]/rfps/bulk-research - Start research for multiple RFPs
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
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

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const validationResult = bulkResearchSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { rfp_ids, additional_context } = validationResult.data;

    // Fetch all RFPs with their organizations
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

    const { data: rfpsData, error: rfpsError } = await supabase
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
      .in('id', rfp_ids)
      .eq('project_id', project.id)
      .is('deleted_at', null);

    if (rfpsError) {
      console.error('Error fetching RFPs:', rfpsError);
      return NextResponse.json({ error: 'Failed to fetch RFPs' }, { status: 500 });
    }

    const rfps = (rfpsData ?? []) as unknown as RfpWithOrg[];

    if (rfps.length === 0) {
      return NextResponse.json({ error: 'No valid RFPs found' }, { status: 404 });
    }

    // Check for any already running research jobs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: runningJobs } = await (supabase as any)
      .from('rfp_research_results')
      .select('rfp_id')
      .in('rfp_id', rfp_ids)
      .eq('status', 'running');

    const runningRfpIds = new Set((runningJobs ?? []).map((j: { rfp_id: string }) => j.rfp_id));
    const rfpsToResearch = rfps.filter((rfp) => !runningRfpIds.has(rfp.id));

    if (rfpsToResearch.length === 0) {
      return NextResponse.json(
        { error: 'All selected RFPs already have research running' },
        { status: 409 }
      );
    }

    // Create research job records for all RFPs
    const jobInserts = rfpsToResearch.map((rfp) => ({
      project_id: project.id,
      rfp_id: rfp.id,
      status: 'running',
      started_at: new Date().toISOString(),
      created_by: user.id,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: jobs, error: insertError } = await (adminClient as any)
      .from('rfp_research_results')
      .insert(jobInserts)
      .select();

    if (insertError || !jobs) {
      console.error('Error creating research jobs:', insertError);
      return NextResponse.json({ error: 'Failed to create research jobs' }, { status: 500 });
    }

    // Build job map for execution
    const jobMap = new Map<string, string>();
    for (const job of jobs) {
      jobMap.set(job.rfp_id, job.id);
    }

    // Execute research in background for each RFP (fire and forget)
    for (const rfp of rfpsToResearch) {
      const jobId = jobMap.get(rfp.id);
      if (!jobId) continue;

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

      executeResearch(jobId, researchContext, project.id, user.id, adminClient).catch((err) => {
        console.error(`Background research execution failed for RFP ${rfp.id}:`, err);
      });
    }

    return NextResponse.json({
      started: rfpsToResearch.length,
      skipped: rfps.length - rfpsToResearch.length,
      jobs: jobs.map((j: { id: string; rfp_id: string }) => ({ id: j.id, rfp_id: j.rfp_id })),
    });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/rfps/bulk-research:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Extract JSON from response that may have extra text
function extractJson(content: string): string {
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

    console.log('[Bulk RFP Research] Starting research for job:', jobId);

    const response = await client.chat([{ role: 'user', content: prompt }], {
      model: RFP_RESEARCH_MODEL,
      temperature: 0.2,
      maxTokens: 8192,
      responseFormat: 'json_object',
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in AI response');
    }

    console.log('[Bulk RFP Research] AI response received for job:', jobId);

    // Extract and parse JSON
    const jsonContent = extractJson(content);
    let parsedData: unknown;
    try {
      parsedData = JSON.parse(jsonContent);
    } catch {
      console.error('[Bulk RFP Research] JSON parse failed, content:', jsonContent.substring(0, 500));
      throw new Error('Failed to parse JSON from AI response');
    }

    // Validate against schema
    const validationResult = rfpResearchResultSchema.safeParse(parsedData);
    if (!validationResult.success) {
      console.error('[Bulk RFP Research] Schema validation failed:', validationResult.error.message);
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
      metadata: { rfpId: context.rfp.id, jobId, bulk: true },
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
      console.error('[Bulk RFP Research] Failed to update job with results:', updateError);
    } else {
      console.log('[Bulk RFP Research] Job completed successfully:', jobId);
    }
  } catch (err) {
    console.error('[Bulk RFP Research] Research execution failed:', err);

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

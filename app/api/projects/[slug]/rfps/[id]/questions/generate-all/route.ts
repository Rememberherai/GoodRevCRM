import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getOpenRouterClient, DEFAULT_MODEL } from '@/lib/openrouter/client';
import { buildRfpResponsePrompt, type RfpResponseContext } from '@/lib/openrouter/prompts';
import { generateRfpResponseInputSchema, aiRfpResponseSchema } from '@/lib/validators/rfp-question';
import type { CompanyContext } from '@/lib/validators/project';
import type { Database } from '@/types/database';

type RfpRow = Database['public']['Tables']['rfps']['Row'];
type RfpQuestionRow = Database['public']['Tables']['rfp_questions']['Row'];

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// POST /api/projects/[slug]/rfps/[id]/questions/generate-all - Generate AI drafts for all unanswered questions
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id: rfpId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate input (same context toggles)
    const body = await request.json();
    const validationResult = generateRfpResponseInputSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const {
      includeCompanyContext,
      includeOrgContext,
      includeLibraryAnswers,
      additionalInstructions,
    } = validationResult.data;

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

    // Get RFP with org
    const { data: rfpData, error: rfpError } = await supabase
      .from('rfps')
      .select('*, organizations(*)')
      .eq('id', rfpId)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();

    if (rfpError || !rfpData) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 });
    }

    const rfp = rfpData as RfpRow & { organizations: any };

    // Get all unanswered questions
    const { data: questionsData, error: questionsError } = await supabase
      .from('rfp_questions')
      .select('*')
      .eq('rfp_id', rfpId)
      .eq('project_id', project.id)
      .eq('status', 'unanswered')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });

    if (questionsError) {
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
    }

    const questions = (questionsData ?? []) as RfpQuestionRow[];

    if (questions.length === 0) {
      return NextResponse.json({ generated: 0, message: 'No unanswered questions found' });
    }

    // Build shared context parts
    let companyContext: RfpResponseContext['companyContext'];
    if (includeCompanyContext) {
      const settings = project.settings as { company_context?: CompanyContext } | null;
      const cc = settings?.company_context;
      if (cc?.name) {
        companyContext = {
          name: cc.name,
          description: cc.description ?? '',
          products: cc.products,
          valuePropositions: cc.value_propositions,
        };
      }
    }

    let organizationContext: RfpResponseContext['organizationContext'];
    if (includeOrgContext && rfp.organizations) {
      const org = rfp.organizations as { name: string; domain?: string | null; industry?: string | null; description?: string | null };
      organizationContext = {
        name: org.name,
        domain: org.domain,
        industry: org.industry,
        description: org.description,
      };
    }

    const client = getOpenRouterClient();
    let generated = 0;
    const errors: string[] = [];

    // Process in batches of 3
    const BATCH_SIZE = 3;
    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
      const batch = questions.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (question) => {
          const promptContext: RfpResponseContext = {
            questionText: question.question_text,
            questionNumber: question.question_number ?? undefined,
            sectionName: question.section_name ?? undefined,
            rfpTitle: rfp.title,
            rfpDescription: rfp.description ?? undefined,
            companyContext,
            organizationContext,
          };

          if (additionalInstructions) {
            promptContext.additionalInstructions = additionalInstructions;
          }

          // Try to include library answers per question
          if (includeLibraryAnswers) {
            try {
              const searchTerms = question.question_text.split(/\s+/).slice(0, 5).join(' ');
              const { data: libraryEntries } = await supabase
                .from('rfp_content_library')
                .select('question_text, answer_text, tags')
                .eq('project_id', project.id)
                .is('deleted_at', null)
                .textSearch('answer_text', searchTerms, { type: 'websearch' })
                .limit(3);

              if (libraryEntries && libraryEntries.length > 0) {
                promptContext.existingApprovedAnswers = libraryEntries.map((entry: any) => ({
                  question: entry.question_text ?? '',
                  answer: entry.answer_text,
                  tags: entry.tags,
                }));
              }
            } catch {
              // Content library table may not exist yet
            }
          }

          const prompt = buildRfpResponsePrompt(promptContext);
          const aiResponse = await client.completeJson(
            prompt,
            aiRfpResponseSchema,
            { model: DEFAULT_MODEL, temperature: 0.5, maxTokens: 4096 }
          );

          // Update the question with the generated answer
          const { error: updateError } = await supabase
            .from('rfp_questions')
            .update({
              answer_text: aiResponse.answer_text,
              answer_html: aiResponse.answer_html ?? null,
              status: 'draft' as RfpQuestionRow['status'],
              ai_generated: true,
              ai_confidence: aiResponse.confidence,
            })
            .eq('id', question.id)
            .eq('project_id', project.id);

          if (updateError) {
            throw new Error(`Failed to save answer for question ${question.id}: ${updateError.message}`);
          }

          return question.id;
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          generated++;
        } else {
          errors.push(result.reason?.message ?? 'Unknown error');
        }
      }
    }

    return NextResponse.json({
      generated,
      total: questions.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error in POST /api/.../generate-all:', error);
    return NextResponse.json(
      { error: 'Failed to generate responses' },
      { status: 500 }
    );
  }
}

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
  params: Promise<{ slug: string; id: string; questionId: string }>;
}

// POST /api/projects/[slug]/rfps/[id]/questions/[questionId]/generate - Generate AI answer
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id: rfpId, questionId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate input
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

    // Get project with settings
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

    // Get the question
    const { data: questionData, error: questionError } = await supabase
      .from('rfp_questions')
      .select('*')
      .eq('id', questionId)
      .eq('rfp_id', rfpId)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();

    if (questionError || !questionData) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    const question = questionData as RfpQuestionRow;

    // Build context for prompt
    const promptContext: RfpResponseContext = {
      questionText: question.question_text,
      questionNumber: question.question_number ?? undefined,
      sectionName: question.section_name ?? undefined,
      rfpTitle: rfp.title,
      rfpDescription: rfp.description ?? undefined,
    };

    // Conditionally include company context
    if (includeCompanyContext) {
      const settings = project.settings as { company_context?: CompanyContext } | null;
      const cc = settings?.company_context;
      if (cc?.name) {
        promptContext.companyContext = {
          name: cc.name,
          description: cc.description ?? '',
          products: cc.products,
          valuePropositions: cc.value_propositions,
        };
      }
    }

    // Conditionally include organization context
    if (includeOrgContext && rfp.organizations) {
      const org = rfp.organizations as { name: string; domain?: string | null; industry?: string | null; description?: string | null };
      promptContext.organizationContext = {
        name: org.name,
        domain: org.domain,
        industry: org.industry,
        description: org.description,
      };
    }

    // Conditionally include library answers (Phase 3 - gracefully skip if table doesn't exist)
    if (includeLibraryAnswers) {
      try {
        const searchTerms = question.question_text.split(/\s+/).slice(0, 5).join(' ');
        const { data: libraryEntries } = await supabase
          .from('rfp_content_library')
          .select('question_text, answer_text, tags')
          .eq('project_id', project.id)
          .is('deleted_at', null)
          .textSearch('answer_text', searchTerms, { type: 'websearch' })
          .limit(5);

        if (libraryEntries && libraryEntries.length > 0) {
          promptContext.existingApprovedAnswers = libraryEntries.map((entry: any) => ({
            question: entry.question_text ?? '',
            answer: entry.answer_text,
            tags: entry.tags,
          }));
        }
      } catch {
        // Content library table may not exist yet - that's OK
      }
    }

    // Add user's additional instructions
    if (additionalInstructions) {
      promptContext.additionalInstructions = additionalInstructions;
    }

    // Build prompt and call AI
    const prompt = buildRfpResponsePrompt(promptContext);
    const client = getOpenRouterClient();

    const aiResponse = await client.completeJson(
      prompt,
      aiRfpResponseSchema,
      {
        model: DEFAULT_MODEL,
        temperature: 0.5,
        maxTokens: 4096,
      }
    );

    return NextResponse.json({
      answer_text: aiResponse.answer_text,
      answer_html: aiResponse.answer_html,
      confidence: aiResponse.confidence,
      reasoning: aiResponse.reasoning,
    });
  } catch (error) {
    console.error('Error in POST /api/.../generate:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}

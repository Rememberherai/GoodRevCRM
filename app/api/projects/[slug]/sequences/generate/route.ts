import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getOpenRouterClient, DEFAULT_MODEL } from '@/lib/openrouter/client';
import { buildSequenceGenerationPrompt } from '@/lib/openrouter/prompts';
import {
  generateSequenceInputSchema,
  generatedSequenceSchema,
  type GeneratedSequence,
} from '@/lib/validators/sequence';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// POST /api/projects/[slug]/sequences/generate - Generate a sequence with AI
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = generateSequenceInputSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const input = validationResult.data;

    // Build the prompt
    const prompt = buildSequenceGenerationPrompt({
      sequenceType: input.sequenceType,
      tone: input.tone,
      numberOfSteps: input.numberOfSteps,
      companyContext: input.companyContext,
      targetAudience: input.targetAudience,
      campaignGoals: input.campaignGoals,
      delayPreferences: input.delayPreferences,
    });

    // Call OpenRouter API
    const openRouterClient = getOpenRouterClient();

    let generatedSequence: GeneratedSequence;
    try {
      generatedSequence = await openRouterClient.completeJson(
        prompt,
        generatedSequenceSchema,
        {
          model: DEFAULT_MODEL,
          temperature: 0.7,
          maxTokens: 8192,
          systemPrompt: 'You are an expert B2B email copywriter specializing in sales sequences. Always respond with valid JSON.',
        }
      );
    } catch (aiError) {
      console.error('AI generation error:', aiError);
      return NextResponse.json(
        { error: 'Failed to generate sequence. Please try again.' },
        { status: 500 }
      );
    }

    // If preview mode, just return the generated content
    if (input.preview) {
      return NextResponse.json({
        preview: true,
        ...generatedSequence,
      });
    }

    // Otherwise, persist to database
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Create the sequence
    const { data: sequence, error: sequenceError } = await supabaseAny
      .from('sequences')
      .insert({
        project_id: project.id,
        organization_id: input.organizationId || null,
        name: generatedSequence.sequence.name,
        description: generatedSequence.sequence.description,
        status: 'draft',
        settings: {
          send_as_reply: true,
          stop_on_reply: true,
          stop_on_bounce: true,
          track_opens: true,
          track_clicks: true,
        },
        created_by: user.id,
      })
      .select()
      .single();

    if (sequenceError) {
      console.error('Error creating sequence:', sequenceError);
      return NextResponse.json(
        { error: 'Failed to save sequence' },
        { status: 500 }
      );
    }

    // Create the steps
    const stepsToInsert = generatedSequence.steps.map((step) => ({
      sequence_id: sequence.id,
      step_number: step.step_number,
      step_type: step.step_type,
      subject: step.subject || null,
      body_html: step.body_html || null,
      body_text: step.body_text || null,
      delay_amount: step.delay_amount || null,
      delay_unit: step.delay_unit || null,
    }));

    const { data: steps, error: stepsError } = await supabaseAny
      .from('sequence_steps')
      .insert(stepsToInsert)
      .select();

    if (stepsError) {
      console.error('Error creating steps:', stepsError);
      // Try to clean up the sequence we just created
      await supabaseAny.from('sequences').delete().eq('id', sequence.id);
      return NextResponse.json(
        { error: 'Failed to save sequence steps' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      preview: false,
      sequence: {
        ...sequence,
        steps,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/sequences/generate:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

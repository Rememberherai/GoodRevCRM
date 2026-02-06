import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getOpenRouterClient, FAST_MODEL } from '@/lib/openrouter/client';
import { logAiUsage } from '@/lib/openrouter/usage';
import { z } from 'zod';

const generateMessageSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  job_title: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  context: z.string().nullable().optional(),
});

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// POST /api/projects/[slug]/linkedin/generate-message
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
    const validationResult = generateMessageSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { first_name, last_name, job_title, company, context: additionalContext } = validationResult.data;

    // Build prompt
    const promptParts = [
      'Write a brief, personalized LinkedIn connection request message.',
      '',
      `Recipient: ${first_name} ${last_name}`,
    ];

    if (job_title) {
      promptParts.push(`Title: ${job_title}`);
    }
    if (company) {
      promptParts.push(`Company: ${company}`);
    }
    if (additionalContext) {
      promptParts.push(`Context: ${additionalContext}`);
    }

    promptParts.push('');
    promptParts.push('Guidelines:');
    promptParts.push('- Maximum 280 characters (LinkedIn limit for connection requests)');
    promptParts.push('- Be professional but personable');
    promptParts.push('- Avoid generic phrases like "I came across your profile"');
    promptParts.push('- Reference something specific about their role or company if possible');
    promptParts.push('- Do NOT include a greeting like "Hi [Name]" - just the message body');
    promptParts.push('- Do NOT include your name or signature');
    promptParts.push('');
    promptParts.push('Return ONLY the message text, nothing else.');

    const prompt = promptParts.join('\n');

    const openRouterClient = getOpenRouterClient();
    const response = await openRouterClient.chat(
      [{ role: 'user', content: prompt }],
      {
        model: FAST_MODEL,
        temperature: 0.8,
        maxTokens: 150,
      }
    );

    const message = response.choices[0]?.message?.content?.trim();

    if (!message) {
      return NextResponse.json(
        { error: 'Failed to generate message' },
        { status: 500 }
      );
    }

    // Log AI usage
    await logAiUsage(supabase, {
      projectId: project.id,
      userId: user.id,
      feature: 'linkedin_message_generation',
      model: response.model,
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
      totalTokens: response.usage?.total_tokens,
      metadata: {
        recipient: `${first_name} ${last_name}`,
      },
    });

    return NextResponse.json({ message });
  } catch (error) {
    console.error('Error generating LinkedIn message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

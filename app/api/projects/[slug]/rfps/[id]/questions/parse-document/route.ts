import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { extractTextFromPdf, extractTextFromPlainText } from '@/lib/pdf/extract-text';
import { getOpenRouterClient, DEFAULT_MODEL } from '@/lib/openrouter/client';
import { logAiUsage } from '@/lib/openrouter/usage';
import { buildRfpQuestionExtractionPrompt } from '@/lib/openrouter/prompts';
import { rfpDocumentExtractionResultSchema } from '@/lib/validators/rfp-question';
import type { CompanyContext } from '@/lib/validators/project';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['application/pdf', 'text/plain'];

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// POST /api/projects/[slug]/rfps/[id]/questions/parse-document
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

    // Get project with settings
    const { data: project } = await supabase
      .from('projects')
      .select('id, settings')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify RFP exists and belongs to project
    const { data: rfp } = await supabase
      .from('rfps')
      .select('id')
      .eq('id', rfpId)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();

    if (!rfp) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF and TXT files are supported.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Extract text from file
    const buffer = Buffer.from(await file.arrayBuffer());
    let documentText: string;

    if (file.type === 'application/pdf') {
      documentText = await extractTextFromPdf(buffer);
    } else {
      documentText = extractTextFromPlainText(buffer.toString('utf-8'));
    }

    if (!documentText.trim()) {
      return NextResponse.json(
        { error: 'Could not extract text from file. The file may be empty or contain only images.' },
        { status: 400 }
      );
    }

    // Get company context
    const settings = project.settings as { company_context?: CompanyContext } | null;
    const cc = settings?.company_context;
    const companyContext = cc?.name
      ? { name: cc.name, description: cc.description, products: cc.products }
      : undefined;

    // Call AI to extract questions
    const prompt = buildRfpQuestionExtractionPrompt(documentText, companyContext);
    const client = getOpenRouterClient();

    const aiResult = await client.completeJsonWithUsage(
      prompt,
      rfpDocumentExtractionResultSchema,
      {
        model: DEFAULT_MODEL,
        temperature: 0.2,
        maxTokens: 8192,
      }
    );

    // Log AI usage
    await logAiUsage(supabase, {
      projectId: project.id,
      userId: user.id,
      feature: 'rfp_question_extraction',
      model: aiResult.model,
      promptTokens: aiResult.usage?.prompt_tokens,
      completionTokens: aiResult.usage?.completion_tokens,
      totalTokens: aiResult.usage?.total_tokens,
      metadata: { fileName: file.name, fileType: file.type, rfpId },
    });

    const extracted = aiResult.data;

    if (extracted.questions.length === 0) {
      return NextResponse.json({
        questions: [],
        documentSummary: extracted.document_summary ?? null,
        message: 'No questions could be extracted from this document.',
      });
    }

    return NextResponse.json({
      questions: extracted.questions,
      documentSummary: extracted.document_summary ?? null,
      totalSectionsFound: extracted.total_sections_found ?? null,
      documentName: file.name,
    });
  } catch (error) {
    console.error('Error in POST /api/.../questions/parse-document:', error);
    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 }
    );
  }
}

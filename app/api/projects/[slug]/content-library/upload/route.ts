import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { CompanyContext } from '@/lib/validators/project';
import type { Database } from '@/types/database';

type ContentLibraryInsert = Database['public']['Tables']['rfp_content_library']['Insert'];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['application/pdf', 'text/plain'];

const extractedEntrySchema = z.object({
  title: z.string(),
  question_text: z.string().optional().nullable(),
  answer_text: z.string(),
  category: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
});

const extractionResultSchema = z.object({
  entries: z.array(extractedEntrySchema),
});

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// POST /api/projects/[slug]/content-library/upload - Upload file and extract content
export async function POST(request: Request, context: RouteContext) {
  try {
    console.log('[content-library/upload] POST handler invoked');

    const { slug } = await context.params;
    console.log('[content-library/upload] slug:', slug);

    const supabase = await createClient();
    console.log('[content-library/upload] supabase client created');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id, settings')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const category = formData.get('category') as string | null;
    const mode = (formData.get('mode') as string | null) ?? 'parse';
    const saveImmediately = formData.get('saveImmediately') === 'true';
    console.log('[content-library/upload] mode:', mode);

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

    // Extract text from file (dynamic import for debug logging)
    console.log('[content-library/upload] importing pdf extract-text module...');
    const { extractTextFromPdf, extractTextFromPlainText } = await import('@/lib/pdf/extract-text');
    console.log('[content-library/upload] pdf module imported successfully');

    const buffer = Buffer.from(await file.arrayBuffer());
    let documentText: string;

    if (file.type === 'application/pdf') {
      console.log('[content-library/upload] extracting text from PDF...');
      documentText = await extractTextFromPdf(buffer);
    } else {
      console.log('[content-library/upload] extracting text from plain text...');
      documentText = extractTextFromPlainText(buffer.toString('utf-8'));
    }
    console.log('[content-library/upload] text extracted, length:', documentText.length);

    if (!documentText.trim()) {
      return NextResponse.json(
        { error: 'Could not extract text from file. The file may be empty or contain only images.' },
        { status: 400 }
      );
    }

    // Get company context for better extraction
    const settings = project.settings as { company_context?: CompanyContext } | null;
    const cc = settings?.company_context;
    const companyContext = cc?.name
      ? { name: cc.name, description: cc.description, products: cc.products }
      : undefined;

    // Call AI to extract/restructure content (dynamic import for debug logging)
    console.log('[content-library/upload] importing openrouter modules...');
    const { buildContentExtractionPrompt, buildContentRestructurePrompt } = await import('@/lib/openrouter/prompts');
    const { getOpenRouterClient, DEFAULT_MODEL } = await import('@/lib/openrouter/client');
    const { logAiUsage } = await import('@/lib/openrouter/usage');
    console.log('[content-library/upload] openrouter modules imported successfully');

    const prompt = mode === 'llm'
      ? buildContentRestructurePrompt(documentText, companyContext, category ?? undefined)
      : buildContentExtractionPrompt(documentText, companyContext, category ?? undefined);
    const client = getOpenRouterClient();

    console.log('[content-library/upload] calling AI for extraction...');
    const aiResult = await client.completeJsonWithUsage(
      prompt,
      extractionResultSchema,
      {
        model: DEFAULT_MODEL,
        temperature: 0.3,
        maxTokens: 8192,
      }
    );

    // Log AI usage
    await logAiUsage(supabase, {
      projectId: project.id,
      userId: user.id,
      feature: mode === 'llm' ? 'content_restructure' : 'content_extraction',
      model: aiResult.model,
      promptTokens: aiResult.usage?.prompt_tokens,
      completionTokens: aiResult.usage?.completion_tokens,
      totalTokens: aiResult.usage?.total_tokens,
      metadata: { fileName: file.name, fileType: file.type },
    });

    const extractedEntries = aiResult.data.entries;

    if (extractedEntries.length === 0) {
      return NextResponse.json({
        entries: [],
        message: 'No Q&A pairs could be extracted from this document.',
      });
    }

    // If saveImmediately, insert into the database
    if (saveImmediately) {
      const inserts: ContentLibraryInsert[] = extractedEntries.map((entry) => ({
        project_id: project.id,
        title: entry.title,
        question_text: entry.question_text ?? null,
        answer_text: entry.answer_text,
        category: entry.category ?? category ?? null,
        tags: entry.tags ?? [],
        source_document_name: file.name,
        created_by: user.id,
      }));

      const { data: savedEntries, error } = await supabase
        .from('rfp_content_library')
        .insert(inserts)
        .select();

      if (error) {
        console.error('Error saving extracted entries:', error);
        return NextResponse.json({ error: 'Failed to save extracted entries' }, { status: 500 });
      }

      return NextResponse.json({
        entries: savedEntries,
        saved: true,
        documentName: file.name,
      });
    }

    // Return extracted entries for user review before saving
    return NextResponse.json({
      entries: extractedEntries.map((e) => ({
        ...e,
        source_document_name: file.name,
      })),
      saved: false,
      documentName: file.name,
    });
  } catch (error) {
    console.error('[content-library/upload] Unhandled error:', error instanceof Error ? error.stack : error);
    return NextResponse.json(
      { error: 'Failed to process file', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

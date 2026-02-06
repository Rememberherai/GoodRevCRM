import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createContentLibraryEntrySchema, bulkCreateContentLibrarySchema } from '@/lib/validators/rfp-content-library';
import type { Database } from '@/types/database';

type ContentLibraryInsert = Database['public']['Tables']['rfp_content_library']['Insert'];

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/content-library - List entries
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

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search')?.slice(0, 500) || null;

    let query = supabase
      .from('rfp_content_library')
      .select('*', { count: 'exact' })
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.textSearch(
        'title',
        search,
        { type: 'websearch' }
      );
    }

    const { data: entries, error, count } = await query.limit(100);

    if (error) {
      console.error('Error fetching content library:', error);
      return NextResponse.json({ error: 'Failed to fetch content library' }, { status: 500 });
    }

    return NextResponse.json({ entries: entries ?? [], total: count ?? 0 });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/content-library:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/content-library - Create entry or bulk create
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

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();

    // Check if bulk create
    if (body.entries && Array.isArray(body.entries)) {
      const validationResult = bulkCreateContentLibrarySchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validationResult.error.flatten() },
          { status: 400 }
        );
      }

      const inserts: ContentLibraryInsert[] = validationResult.data.entries.map((entry) => ({
        project_id: project.id,
        title: entry.title,
        question_text: entry.question_text ?? null,
        answer_text: entry.answer_text,
        answer_html: entry.answer_html ?? null,
        category: entry.category ?? null,
        tags: entry.tags ?? [],
        source_rfp_id: entry.source_rfp_id ?? null,
        source_question_id: entry.source_question_id ?? null,
        source_document_name: entry.source_document_name ?? null,
        created_by: user.id,
      }));

      const { data: entries, error } = await supabase
        .from('rfp_content_library')
        .insert(inserts)
        .select();

      if (error) {
        console.error('Error bulk creating entries:', error);
        return NextResponse.json({ error: 'Failed to create entries' }, { status: 500 });
      }

      return NextResponse.json({ entries }, { status: 201 });
    }

    // Single create
    const validationResult = createContentLibraryEntrySchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const input = validationResult.data;

    const { data: entry, error } = await supabase
      .from('rfp_content_library')
      .insert({
        project_id: project.id,
        title: input.title,
        question_text: input.question_text ?? null,
        answer_text: input.answer_text,
        answer_html: input.answer_html ?? null,
        category: input.category ?? null,
        tags: input.tags ?? [],
        source_rfp_id: input.source_rfp_id ?? null,
        source_question_id: input.source_question_id ?? null,
        source_document_name: input.source_document_name ?? null,
        created_by: user.id,
      } satisfies ContentLibraryInsert)
      .select()
      .single();

    if (error) {
      console.error('Error creating entry:', error);
      return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 });
    }

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/content-library:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

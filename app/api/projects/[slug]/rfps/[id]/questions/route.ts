import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createRfpQuestionSchema, bulkCreateRfpQuestionsSchema } from '@/lib/validators/rfp-question';
import type { Database } from '@/types/database';

type RfpQuestionInsert = Database['public']['Tables']['rfp_questions']['Insert'];
type RfpQuestion = Database['public']['Tables']['rfp_questions']['Row'];

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/rfps/[id]/questions - List questions for an RFP
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
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
      .eq('id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();

    if (rfpError || !rfp) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const section = searchParams.get('section');

    // Build query
    let query = supabase
      .from('rfp_questions')
      .select('*', { count: 'exact' })
      .eq('rfp_id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null);

    // Apply filters
    if (status) {
      query = query.eq('status', status as Database['public']['Enums']['rfp_question_status']);
    }
    if (section) {
      query = query.eq('section_name', section);
    }

    // Order by sort_order then created_at
    query = query.order('sort_order', { ascending: true }).order('created_at', { ascending: true });

    const { data: questions, error, count } = await query;

    if (error) {
      console.error('Error fetching RFP questions:', error);
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
    }

    // Calculate counts by status
    const allQuestions = questions as RfpQuestion[];
    const counts = {
      total: allQuestions.length,
      unanswered: allQuestions.filter(q => q.status === 'unanswered').length,
      draft: allQuestions.filter(q => q.status === 'draft').length,
      review: allQuestions.filter(q => q.status === 'review').length,
      approved: allQuestions.filter(q => q.status === 'approved').length,
    };

    // Get unique sections
    const sections = [...new Set(allQuestions.map(q => q.section_name).filter(Boolean))] as string[];

    // Get comment counts per question
    const { data: commentRows } = await supabase
      .from('rfp_question_comments')
      .select('question_id')
      .eq('rfp_id', id)
      .is('deleted_at', null);

    const commentCountMap: Record<string, number> = {};
    if (commentRows) {
      for (const row of commentRows) {
        commentCountMap[row.question_id] = (commentCountMap[row.question_id] || 0) + 1;
      }
    }

    const questionsWithMeta = allQuestions.map(q => ({
      ...q,
      comment_count: commentCountMap[q.id] || 0,
    }));

    return NextResponse.json({
      questions: questionsWithMeta,
      counts,
      sections,
      total: count ?? 0,
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/rfps/[id]/questions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/rfps/[id]/questions - Create question(s)
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
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

    // Verify RFP exists
    const { data: rfp, error: rfpError } = await supabase
      .from('rfps')
      .select('id')
      .eq('id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();

    if (rfpError || !rfp) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 });
    }

    const body = await request.json();

    // Support both single question and bulk create
    const isBulk = body.questions !== undefined;

    if (isBulk) {
      const validationResult = bulkCreateRfpQuestionsSchema.safeParse(body);

      if (!validationResult.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validationResult.error.flatten() },
          { status: 400 }
        );
      }

      // Get current max sort_order for this RFP
      const { data: maxSort } = await supabase
        .from('rfp_questions')
        .select('sort_order')
        .eq('rfp_id', id)
        .is('deleted_at', null)
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();

      let nextSortOrder = (maxSort?.sort_order ?? -1) + 1;

      const questionsToInsert: RfpQuestionInsert[] = validationResult.data.questions.map((q) => ({
        ...q,
        rfp_id: id,
        project_id: project.id,
        created_by: user.id,
        sort_order: q.sort_order ?? nextSortOrder++,
      }));

      const { data: questions, error } = await supabase
        .from('rfp_questions')
        .insert(questionsToInsert)
        .select();

      if (error) {
        console.error('Error bulk creating questions:', error);
        return NextResponse.json({ error: 'Failed to create questions' }, { status: 500 });
      }

      return NextResponse.json({ questions: questions as RfpQuestion[] }, { status: 201 });
    } else {
      const validationResult = createRfpQuestionSchema.safeParse(body);

      if (!validationResult.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validationResult.error.flatten() },
          { status: 400 }
        );
      }

      // Get current max sort_order
      const { data: maxSort } = await supabase
        .from('rfp_questions')
        .select('sort_order')
        .eq('rfp_id', id)
        .is('deleted_at', null)
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();

      const nextSortOrder = (maxSort?.sort_order ?? -1) + 1;

      const questionData: RfpQuestionInsert = {
        ...validationResult.data,
        rfp_id: id,
        project_id: project.id,
        created_by: user.id,
        sort_order: validationResult.data.sort_order ?? nextSortOrder,
      };

      const { data: question, error } = await supabase
        .from('rfp_questions')
        .insert(questionData)
        .select()
        .single();

      if (error) {
        console.error('Error creating question:', error);
        return NextResponse.json({ error: 'Failed to create question' }, { status: 500 });
      }

      return NextResponse.json({ question: question as RfpQuestion }, { status: 201 });
    }
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/rfps/[id]/questions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateRfpQuestionSchema } from '@/lib/validators/rfp-question';
import type { Database } from '@/types/database';

type RfpQuestionUpdate = Database['public']['Tables']['rfp_questions']['Update'];
type RfpQuestion = Database['public']['Tables']['rfp_questions']['Row'];

interface RouteContext {
  params: Promise<{ slug: string; id: string; questionId: string }>;
}

// GET /api/projects/[slug]/rfps/[id]/questions/[questionId] - Get single question
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id, questionId } = await context.params;
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

    const { data: question, error } = await supabase
      .from('rfp_questions')
      .select('*')
      .eq('id', questionId)
      .eq('rfp_id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();

    if (error || !question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    return NextResponse.json({ question: question as RfpQuestion });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/rfps/[id]/questions/[questionId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/rfps/[id]/questions/[questionId] - Update question
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id, questionId } = await context.params;
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

    const body = await request.json();
    const validationResult = updateRfpQuestionSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const updates = validationResult.data;

    const updateData: RfpQuestionUpdate = {};
    if (updates.section_name !== undefined) updateData.section_name = updates.section_name;
    if (updates.question_number !== undefined) updateData.question_number = updates.question_number;
    if (updates.question_text !== undefined) updateData.question_text = updates.question_text;
    if (updates.answer_text !== undefined) updateData.answer_text = updates.answer_text;
    if (updates.answer_html !== undefined) updateData.answer_html = updates.answer_html;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.assigned_to !== undefined) {
      if (updates.assigned_to !== null) {
        const { data: member } = await supabase
          .from('project_memberships')
          .select('id')
          .eq('project_id', project.id)
          .eq('user_id', updates.assigned_to)
          .single();
        if (!member) {
          return NextResponse.json({ error: 'Assigned user is not a project member' }, { status: 400 });
        }
      }
      updateData.assigned_to = updates.assigned_to;
    }
    if (updates.sort_order !== undefined) updateData.sort_order = updates.sort_order;
    if (updates.notes !== undefined) updateData.notes = updates.notes;

    const { data: question, error } = await supabase
      .from('rfp_questions')
      .update(updateData)
      .eq('id', questionId)
      .eq('rfp_id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Question not found' }, { status: 404 });
      }
      console.error('Error updating question:', error);
      return NextResponse.json({ error: 'Failed to update question' }, { status: 500 });
    }

    return NextResponse.json({ question: question as RfpQuestion });
  } catch (error) {
    console.error('Error in PATCH /api/projects/[slug]/rfps/[id]/questions/[questionId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/rfps/[id]/questions/[questionId] - Soft delete question
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id, questionId } = await context.params;
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

    const { error } = await supabase
      .from('rfp_questions')
      .update({ deleted_at: new Date().toISOString() } as RfpQuestionUpdate)
      .eq('id', questionId)
      .eq('rfp_id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null);

    if (error) {
      console.error('Error deleting question:', error);
      return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/projects/[slug]/rfps/[id]/questions/[questionId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

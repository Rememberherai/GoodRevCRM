import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createRfpQuestionCommentSchema } from '@/lib/validators/rfp-question-comment';

interface RouteContext {
  params: Promise<{ slug: string; id: string; questionId: string }>;
}

// GET /api/projects/[slug]/rfps/[id]/questions/[questionId]/comments
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id: rfpId, questionId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch comments with author info
    const { data: comments, error } = await supabase
      .from('rfp_question_comments')
      .select(`
        *,
        author:users!created_by(id, full_name, email, avatar_url)
      `)
      .eq('question_id', questionId)
      .eq('rfp_id', rfpId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching comments:', error);
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
    }

    return NextResponse.json({
      comments: comments ?? [],
      count: comments?.length ?? 0,
    });
  } catch (error) {
    console.error('Error in GET /api/.../comments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/rfps/[id]/questions/[questionId]/comments
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

    // Get project
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify RFP + question
    const { data: question } = await supabase
      .from('rfp_questions')
      .select('id, question_text, assigned_to')
      .eq('id', questionId)
      .eq('rfp_id', rfpId)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Validate body
    const body = await request.json();
    const validationResult = createRfpQuestionCommentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // Insert comment
    const { data: comment, error: insertError } = await supabase
      .from('rfp_question_comments')
      .insert({
        question_id: questionId,
        rfp_id: rfpId,
        project_id: project.id,
        content: validationResult.data.content,
        created_by: user.id,
      })
      .select(`
        *,
        author:users!created_by(id, full_name, email, avatar_url)
      `)
      .single();

    if (insertError) {
      console.error('Error creating comment:', insertError);
      return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
    }

    // Notify assigned user if different from commenter
    if (question.assigned_to && question.assigned_to !== user.id) {
      // Get commenter name for notification
      const { data: commenter } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const commenterName = commenter?.full_name ?? 'Someone';
      const questionPreview = question.question_text.slice(0, 80);

      try {
        await supabase.rpc('create_notification' as never, {
          p_user_id: question.assigned_to,
          p_type: 'comment',
          p_title: 'New comment on RFP question',
          p_message: `${commenterName} commented on "${questionPreview}${question.question_text.length > 80 ? '...' : ''}"`,
          p_project_id: project.id,
          p_entity_type: 'rfp_question',
          p_entity_id: questionId,
          p_action_url: `/projects/${slug}/rfps/${rfpId}?tab=questions&q=${questionId}`,
        } as never);
      } catch (notifErr) {
        // Don't fail the request if notification fails
        console.error('Failed to create notification:', notifErr);
      }
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/.../comments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

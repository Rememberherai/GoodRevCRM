import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ slug: string; id: string; questionId: string; commentId: string }>;
}

// DELETE /api/projects/[slug]/rfps/[id]/questions/[questionId]/comments/[commentId]
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id: rfpId, questionId, commentId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve project from slug
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Soft-delete the comment scoped to project/RFP/question
    const { error } = await supabase
      .from('rfp_question_comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', commentId)
      .eq('project_id', project.id)
      .eq('rfp_id', rfpId)
      .eq('question_id', questionId)
      .eq('created_by', user.id);

    if (error) {
      console.error('Error deleting comment:', error);
      return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/.../comments/[commentId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ slug: string; id: string; questionId: string; commentId: string }>;
}

// DELETE /api/projects/[slug]/rfps/[id]/questions/[questionId]/comments/[commentId]
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { commentId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Soft-delete the comment (RLS ensures only own comments)
    const { error } = await supabase
      .from('rfp_question_comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', commentId)
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

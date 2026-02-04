import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateEntityCommentSchema } from '@/lib/validators/entity-comment';

interface RouteContext {
  params: Promise<{ slug: string; commentId: string }>;
}

// PATCH /api/projects/[slug]/comments/[commentId]
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, commentId } = await context.params;
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

    // Validate body
    const body = await request.json();
    const validationResult = updateEntityCommentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { content, mentions } = validationResult.data;

    // Update comment (RLS ensures own-comment only)
    const supabaseAny = supabase as any;
    const { data: comment, error: updateError } = await supabaseAny
      .from('entity_comments')
      .update({ content, mentions })
      .eq('id', commentId)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .select(`
        *,
        author:users!created_by(id, full_name, email, avatar_url)
      `)
      .single();

    if (updateError) {
      console.error('Error updating entity comment:', updateError);
      return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 });
    }

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    return NextResponse.json({ comment });
  } catch (error) {
    console.error('Error in PATCH /api/projects/[slug]/comments/[commentId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/comments/[commentId]
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, commentId } = await context.params;
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

    // Soft delete (RLS ensures own-comment only)
    const supabaseAny = supabase as any;
    const { error: deleteError } = await supabaseAny
      .from('entity_comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', commentId)
      .eq('project_id', project.id)
      .eq('created_by', user.id)
      .is('deleted_at', null);

    if (deleteError) {
      console.error('Error deleting entity comment:', deleteError);
      return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/projects/[slug]/comments/[commentId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

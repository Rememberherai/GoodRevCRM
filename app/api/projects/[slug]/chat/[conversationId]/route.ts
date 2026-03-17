import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ slug: string; conversationId: string }>;
}

const renameSchema = z.object({
  title: z.string().min(1).max(255),
});

// PATCH /api/projects/[slug]/chat/[conversationId] — Rename a conversation
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, conversationId } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const body = await request.json();
    const validation = renameSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { error } = await db
      .from('chat_conversations')
      .update({ title: validation.data.title })
      .eq('id', conversationId)
      .eq('project_id', project.id)
      .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: 'Failed to rename conversation' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/chat/[conversationId] — Delete a conversation
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, conversationId } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // Verify ownership and delete (messages cascade)
    const { error } = await db
      .from('chat_conversations')
      .delete()
      .eq('id', conversationId)
      .eq('project_id', project.id)
      .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

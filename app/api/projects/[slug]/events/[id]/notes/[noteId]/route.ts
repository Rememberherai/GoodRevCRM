import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ slug: string; id: string; noteId: string }>;
}

const updateEventNoteSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  content_html: z.string().max(100000).nullable().optional(),
  category: z.enum(['feedback', 'observation', 'general']).nullable().optional(),
  is_pinned: z.boolean().optional(),
});

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id, noteId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'view');

    const { data: event } = await supabase
      .from('events').select('id').eq('id', id).eq('project_id', project.id).single();
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;
    const { data: note, error } = await supabaseAny
      .from('notes')
      .select('*, author:users!notes_created_by_fkey(id, full_name, email, avatar_url)')
      .eq('id', noteId)
      .eq('project_id', project.id)
      .eq('event_id', id)
      .single();

    if (error || !note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json(note);
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in GET /api/projects/[slug]/events/[id]/notes/[noteId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id, noteId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'update');

    const { data: event } = await supabase
      .from('events').select('id').eq('id', id).eq('project_id', project.id).single();
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const body = await request.json();
    const validation = updateEventNoteSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;
    const { data: note, error } = await supabaseAny
      .from('notes')
      .update({
        ...validation.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', noteId)
      .eq('project_id', project.id)
      .eq('event_id', id)
      .eq('created_by', user.id)
      .select('*, author:users!notes_created_by_fkey(id, full_name, email, avatar_url)')
      .single();

    if (error) {
      console.error('Error updating event note:', error);
      return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
    }

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json(note);
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in PATCH /api/projects/[slug]/events/[id]/notes/[noteId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id, noteId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'delete');

    const { data: event } = await supabase
      .from('events').select('id').eq('id', id).eq('project_id', project.id).single();
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;
    const { error } = await supabaseAny
      .from('notes')
      .delete()
      .eq('id', noteId)
      .eq('project_id', project.id)
      .eq('event_id', id)
      .eq('created_by', user.id);

    if (error) {
      console.error('Error deleting event note:', error);
      return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in DELETE /api/projects/[slug]/events/[id]/notes/[noteId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

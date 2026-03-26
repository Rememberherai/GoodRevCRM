import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'update');

    const { data: currentEvent } = await supabase
      .from('events').select('status').eq('id', id).eq('project_id', project.id).single();
    if (!currentEvent) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body.status !== 'string' || !['draft', 'published'].includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status. Must be "draft" or "published".' }, { status: 400 });
    }
    const targetStatus = body.status as 'draft' | 'published';

    const updateData: Record<string, unknown> = { status: targetStatus };
    if (targetStatus === 'published' && currentEvent.status === 'draft') {
      updateData.published_at = new Date().toISOString();
    } else if (targetStatus === 'draft') {
      updateData.published_at = null;
    }

    const { data: event, error } = await supabase
      .from('events').update(updateData).eq('id', id).eq('project_id', project.id).select().single();

    if (error) {
      console.error('Error publishing event:', error);
      return NextResponse.json({ error: 'Failed to update event status' }, { status: 500 });
    }

    if (targetStatus === 'published') {
      emitAutomationEvent({
        projectId: project.id,
        triggerType: 'event.published',
        entityType: 'event',
        entityId: id,
        data: event as Record<string, unknown>,
      }).catch(err => console.error('Failed to emit automation event:', err));
    }

    return NextResponse.json({ event });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in POST /api/projects/[slug]/events/[id]/publish:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

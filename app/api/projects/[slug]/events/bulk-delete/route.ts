import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'delete');

    const body = await request.json();
    const eventIds = body.event_ids;

    if (!Array.isArray(eventIds) || eventIds.length === 0 || eventIds.length > 50) {
      return NextResponse.json({ error: 'Provide 1-50 event_ids' }, { status: 400 });
    }

    // Validate all IDs are UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!eventIds.every((id: unknown) => typeof id === 'string' && uuidRegex.test(id))) {
      return NextResponse.json({ error: 'Invalid event ID format' }, { status: 400 });
    }

    const { data: deleted, error } = await supabase
      .from('events')
      .delete()
      .in('id', eventIds)
      .eq('project_id', project.id)
      .select('id');

    if (error) {
      if (error.code === '23503') {
        return NextResponse.json({ error: 'Some events have registrations and cannot be deleted. Cancel or remove registrations first.' }, { status: 409 });
      }
      console.error('Error bulk deleting events:', error);
      return NextResponse.json({ error: 'Failed to delete events' }, { status: 500 });
    }

    const deletedIds = (deleted ?? []).map(e => e.id);

    // Emit automation events for each deleted event
    for (const id of deletedIds) {
      emitAutomationEvent({
        projectId: project.id,
        triggerType: 'entity.deleted',
        entityType: 'event',
        entityId: id,
        data: { id, project_id: project.id },
      }).catch(err => console.error('Failed to emit automation event:', err));
    }

    return NextResponse.json({ deleted: deletedIds.length, deleted_ids: deletedIds });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in POST /api/projects/[slug]/events/bulk-delete:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

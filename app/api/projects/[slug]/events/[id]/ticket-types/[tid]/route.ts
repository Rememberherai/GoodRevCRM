import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { updateTicketTypeSchema } from '@/lib/validators/event';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ slug: string; id: string; tid: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id, tid } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'update');

    // Verify event belongs to project
    const { data: event } = await supabase
      .from('events').select('id').eq('id', id).eq('project_id', project.id).single();
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const body = await request.json();
    const validationResult = updateTicketTypeSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Validation failed', details: validationResult.error.flatten() }, { status: 400 });
    }

    const { data: existingTicketType } = await supabase
      .from('event_ticket_types')
      .select('id, sales_start_at, sales_end_at')
      .eq('id', tid)
      .eq('event_id', id)
      .single();
    if (!existingTicketType) return NextResponse.json({ error: 'Ticket type not found' }, { status: 404 });

    const updates = validationResult.data;
    const mergedSalesStartAt = updates.sales_start_at !== undefined
      ? updates.sales_start_at
      : existingTicketType.sales_start_at;
    const mergedSalesEndAt = updates.sales_end_at !== undefined
      ? updates.sales_end_at
      : existingTicketType.sales_end_at;

    if (
      mergedSalesStartAt &&
      mergedSalesEndAt &&
      new Date(mergedSalesEndAt) <= new Date(mergedSalesStartAt)
    ) {
      return NextResponse.json({
        error: 'Validation failed',
        details: { fieldErrors: { sales_end_at: ['Sales end time must be after start time'] }, formErrors: [] },
      }, { status: 400 });
    }

    const { data: ticketType, error } = await supabase
      .from('event_ticket_types')
      .update(updates)
      .eq('id', tid)
      .eq('event_id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return NextResponse.json({ error: 'Ticket type not found' }, { status: 404 });
      console.error('Error updating ticket type:', error);
      return NextResponse.json({ error: 'Failed to update ticket type' }, { status: 500 });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.updated',
      entityType: 'event_ticket_type',
      entityId: tid,
      data: ticketType as Record<string, unknown>,
    }).catch(err => console.error('Failed to emit automation event:', err));

    return NextResponse.json({ ticket_type: ticketType });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in PATCH ticket-types/[tid]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id, tid } = await context.params;
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

    const { error } = await supabase
      .from('event_ticket_types')
      .delete()
      .eq('id', tid)
      .eq('event_id', id)
      .select('id')
      .single();

    if (error) {
      if (error.code === 'PGRST116') return NextResponse.json({ error: 'Ticket type not found' }, { status: 404 });
      if (error.code === '23503') return NextResponse.json({ error: 'Cannot delete ticket type: it has existing registrations' }, { status: 409 });
      console.error('Error deleting ticket type:', error);
      return NextResponse.json({ error: 'Failed to delete ticket type' }, { status: 500 });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.deleted',
      entityType: 'event_ticket_type',
      entityId: tid,
      data: { id: tid, event_id: id },
    }).catch(err => console.error('Failed to emit automation event:', err));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in DELETE ticket-types/[tid]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { updateEventSchema } from '@/lib/validators/event';
import type { Database } from '@/types/database';

type EventUpdate = Database['public']['Tables']['events']['Update'];

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'view');

    const { data: event, error } = await supabase
      .from('events').select('*').eq('id', id).eq('project_id', project.id).single();
    if (error || !event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    // Fetch per-status ticket counts, ticket types, and waiver count using head:true count queries
    // (avoids PostgREST 1000-row default limit that would silently truncate client-side counts)
    const statuses = ['confirmed', 'waitlisted', 'pending_approval', 'pending_waiver', 'cancelled'] as const;
    const [ticketTypesResult, waiverCountResult, registrationRowCountResult, ...statusResults] = await Promise.all([
      supabase
        .from('event_ticket_types')
        .select('*')
        .eq('event_id', id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('event_waivers')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', id),
      supabase
        .from('event_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', id),
      ...statuses.map(status =>
        supabase
          .from('event_registration_tickets')
          .select('id, event_registrations!inner(id, event_id, status)', { count: 'exact', head: true })
          .eq('event_registrations.event_id', id)
          .eq('event_registrations.status', status)
      ),
    ]);

    const statusCounts: Record<string, number> = {};
    let totalCount = 0;
    statuses.forEach((status, i) => {
      const count = statusResults[i]?.count ?? 0;
      statusCounts[status] = count;
      totalCount += count;
    });

    return NextResponse.json({
      event: {
        ...event,
        registration_count: totalCount,
        registration_row_count: registrationRowCountResult.count ?? 0,
        registration_status_counts: statusCounts,
        ticket_types: ticketTypesResult.data ?? [],
        waiver_count: waiverCountResult.count ?? 0,
      },
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in GET /api/projects/[slug]/events/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'update');

    const body = await request.json();

    // Fetch old record for field-change tracking and merged validation
    const { data: oldEvent } = await supabase
      .from('events').select('*').eq('id', id).eq('project_id', project.id).single();
    if (!oldEvent) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const validationResult = updateEventSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Validation failed', details: validationResult.error.flatten() }, { status: 400 });
    }

    const updates = validationResult.data;
    const mergedStartsAt = updates.starts_at !== undefined ? updates.starts_at : oldEvent.starts_at;
    const mergedEndsAt = updates.ends_at !== undefined ? updates.ends_at : oldEvent.ends_at;
    if (new Date(mergedEndsAt) <= new Date(mergedStartsAt)) {
      return NextResponse.json({
        error: 'Validation failed',
        details: { fieldErrors: { ends_at: ['End time must be after start time'] }, formErrors: [] },
      }, { status: 400 });
    }

    const mergedRegistrationOpensAt = updates.registration_opens_at !== undefined
      ? updates.registration_opens_at
      : oldEvent.registration_opens_at;
    const mergedRegistrationClosesAt = updates.registration_closes_at !== undefined
      ? updates.registration_closes_at
      : oldEvent.registration_closes_at;
    if (
      mergedRegistrationOpensAt &&
      mergedRegistrationClosesAt &&
      new Date(mergedRegistrationClosesAt) <= new Date(mergedRegistrationOpensAt)
    ) {
      return NextResponse.json({
        error: 'Validation failed',
        details: { fieldErrors: { registration_closes_at: ['Registration close time must be after open time'] }, formErrors: [] },
      }, { status: 400 });
    }

    const updateData: EventUpdate = {};
    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'requires_waiver' && value !== undefined) {
        (updateData as Record<string, unknown>)[key] = value;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No supported updates provided' }, { status: 400 });
    }

    // Mark series instance as modified if part of a series
    if (oldEvent.series_id) {
      updateData.series_instance_modified = true;
    }

    const { data: event, error } = await supabase
      .from('events').update(updateData).eq('id', id).eq('project_id', project.id).select().single();

    if (error) {
      if (error.code === 'PGRST116') return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      if (error.code === '23505') return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
      console.error('Error updating event:', error);
      return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.updated',
      entityType: 'event',
      entityId: id,
      data: event as Record<string, unknown>,
      previousData: oldEvent as Record<string, unknown>,
    }).catch(err => console.error('Failed to emit automation event:', err));

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && (oldEvent as Record<string, unknown>)[key] !== value) {
        emitAutomationEvent({
          projectId: project.id,
          triggerType: 'field.changed',
          entityType: 'event',
          entityId: id,
          data: event as Record<string, unknown>,
          previousData: { [key]: (oldEvent as Record<string, unknown>)[key] },
        }).catch(err => console.error('Failed to emit automation event:', err));
      }
    }

    return NextResponse.json({ event });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in PATCH /api/projects/[slug]/events/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'delete');

    const { error } = await supabase
      .from('events').delete().eq('id', id).eq('project_id', project.id).select('id').single();

    if (error) {
      if (error.code === 'PGRST116') return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      if (error.code === '23503') return NextResponse.json({ error: 'Cannot delete event: it has existing registrations. Cancel or remove registrations first.' }, { status: 409 });
      console.error('Error deleting event:', error);
      return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.deleted',
      entityType: 'event',
      entityId: id,
      data: { id, project_id: project.id },
    }).catch(err => console.error('Failed to emit automation event:', err));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in DELETE /api/projects/[slug]/events/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { updateEventSeriesSchema } from '@/lib/validators/event';
import { parseSeriesTicketTemplates, serializeSeriesTicketTemplates, syncFutureSeriesInstances, updateFutureInstances } from '@/lib/events/series';

interface RouteContext {
  params: Promise<{ slug: string; seriesId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, seriesId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'view');

    const { data: series, error } = await supabase
      .from('event_series').select('*').eq('id', seriesId).eq('project_id', project.id).single();
    if (error || !series) return NextResponse.json({ error: 'Series not found' }, { status: 404 });

    // Count instances
    const { count: instanceCount } = await supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('series_id', seriesId);

    return NextResponse.json({
      series: { ...series, instance_count: instanceCount ?? 0 },
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in GET series/[seriesId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, seriesId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'update');

    const body = await request.json();
    const validationResult = updateEventSeriesSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Validation failed', details: validationResult.error.flatten() }, { status: 400 });
    }

    const updates = validationResult.data;
    const oldSeriesResult = await supabase
      .from('event_series')
      .select('*')
      .eq('id', seriesId)
      .eq('project_id', project.id)
      .single();
    const oldSeries = oldSeriesResult.data;
    if (!oldSeries) return NextResponse.json({ error: 'Series not found' }, { status: 404 });

    const scheduleFields = [
      'recurrence_frequency',
      'recurrence_days_of_week',
      'recurrence_interval',
      'recurrence_until',
      'recurrence_count',
      'recurrence_day_position',
      'template_start_time',
      'template_end_time',
      'timezone',
    ];

    const mergedRecurrenceUntil = updates.recurrence_until !== undefined
      ? updates.recurrence_until
      : oldSeries.recurrence_until;
    const mergedRecurrenceCount = updates.recurrence_count !== undefined
      ? updates.recurrence_count
      : oldSeries.recurrence_count;
    if (mergedRecurrenceUntil && mergedRecurrenceCount) {
      return NextResponse.json({
        error: 'Validation failed',
        details: { fieldErrors: { recurrence_until: ['Specify either recurrence_until or recurrence_count, not both'] }, formErrors: [] },
      }, { status: 400 });
    }

    const mergedTemplateStartTime = updates.template_start_time !== undefined
      ? updates.template_start_time
      : oldSeries.template_start_time;
    const mergedTemplateEndTime = updates.template_end_time !== undefined
      ? updates.template_end_time
      : oldSeries.template_end_time;
    if (mergedTemplateEndTime <= mergedTemplateStartTime) {
      return NextResponse.json({
        error: 'Validation failed',
        details: { fieldErrors: { template_end_time: ['End time must be after start time'] }, formErrors: [] },
      }, { status: 400 });
    }

    const mergedFrequency = updates.recurrence_frequency !== undefined
      ? updates.recurrence_frequency
      : oldSeries.recurrence_frequency;
    const mergedDaysOfWeek = updates.recurrence_days_of_week !== undefined
      ? updates.recurrence_days_of_week
      : oldSeries.recurrence_days_of_week;
    const mergedDayPosition = updates.recurrence_day_position !== undefined
      ? updates.recurrence_day_position
      : oldSeries.recurrence_day_position;

    if (
      (mergedFrequency === 'weekly' || mergedFrequency === 'biweekly') &&
      (!mergedDaysOfWeek || mergedDaysOfWeek.length === 0)
    ) {
      return NextResponse.json({
        error: 'Validation failed',
        details: { fieldErrors: { recurrence_days_of_week: ['Days of week are required for weekly/biweekly recurrence'] }, formErrors: [] },
      }, { status: 400 });
    }

    if (
      mergedFrequency === 'monthly' &&
      mergedDayPosition &&
      (!mergedDaysOfWeek || mergedDaysOfWeek.length === 0)
    ) {
      return NextResponse.json({
        error: 'Validation failed',
        details: { fieldErrors: { recurrence_days_of_week: ['Day of week is required when using day position for monthly recurrence'] }, formErrors: [] },
      }, { status: 400 });
    }

    const touchesSchedule = scheduleFields.some((field) => (updates as Record<string, unknown>)[field] !== undefined);

    const updateData: Record<string, unknown> = { ...updates };
    if (updates.ticket_types !== undefined) {
      const existingTicketTemplates = parseSeriesTicketTemplates(oldSeries.ticket_types);
      const serializedTicketTypes = serializeSeriesTicketTemplates(updates.ticket_types, existingTicketTemplates);
      const structurallyChanged = existingTicketTemplates.length !== serializedTicketTypes.length;

      const { count: activeSeriesRegistrationCount } = await supabase
        .from('event_series_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('series_id', seriesId)
        .eq('status', 'active');

      if (structurallyChanged && (activeSeriesRegistrationCount ?? 0) > 0) {
        return NextResponse.json(
          { error: 'Cannot add or remove series ticket templates after whole-series registrations exist.' },
          { status: 409 }
        );
      }

      const futureUnmodifiedEventsResult = await supabase
        .from('events')
        .select('id')
        .eq('series_id', seriesId)
        .eq('series_instance_modified', false)
        .gt('starts_at', new Date().toISOString());

      const futureUnmodifiedEvents = futureUnmodifiedEventsResult.data ?? [];
      if (futureUnmodifiedEvents.length > 0) {
        const eventIds = futureUnmodifiedEvents.map((event) => event.id);

        const { count: registrationCount } = await supabase
          .from('event_registrations')
          .select('id', { count: 'exact', head: true })
          .in('event_id', eventIds)
          .neq('status', 'cancelled');

        if (structurallyChanged && (registrationCount ?? 0) > 0) {
          return NextResponse.json(
            { error: 'Cannot add or remove series ticket templates after future instances have registrations.' },
            { status: 409 }
          );
        }

        if (!structurallyChanged && (registrationCount ?? 0) > 0) {
          for (const event of futureUnmodifiedEvents) {
            const { count: eventRegistrationCount } = await supabase
              .from('event_registrations')
              .select('id', { count: 'exact', head: true })
              .eq('event_id', event.id)
              .neq('status', 'cancelled');

            if ((eventRegistrationCount ?? 0) === 0) continue;

            const { count: eventTicketTypeCount } = await supabase
              .from('event_ticket_types')
              .select('id', { count: 'exact', head: true })
              .eq('event_id', event.id);

            if ((eventTicketTypeCount ?? 0) !== existingTicketTemplates.length) {
              return NextResponse.json(
                { error: 'Cannot update series ticket templates because a future registered instance has diverged from the template shape.' },
                { status: 409 }
              );
            }
          }
        }
      }

      updateData.ticket_types = serializedTicketTypes as unknown as import('@/types/database').Json;
    }

    const nextSeriesCandidate = {
      ...oldSeries,
      ...updateData,
    };

    if (touchesSchedule) {
      const preflightResult = await syncFutureSeriesInstances({
        seriesId,
        previousSeries: oldSeries,
        nextSeries: nextSeriesCandidate,
        dryRun: true,
      });

      if (preflightResult.error) {
        return NextResponse.json({ error: preflightResult.error }, { status: 409 });
      }
    }

    const { data: series, error } = await supabase
      .from('event_series')
      .update(updateData)
      .eq('id', seriesId)
      .eq('project_id', project.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return NextResponse.json({ error: 'Series not found' }, { status: 404 });
      console.error('Error updating series:', error);
      return NextResponse.json({ error: 'Failed to update series' }, { status: 500 });
    }

    // Propagate template changes to future unmodified instances
    const propagatable: Record<string, unknown> = {};
    const propagatableFields = ['title', 'description', 'description_html', 'venue_name', 'venue_address',
      'venue_latitude', 'venue_longitude', 'virtual_url', 'location_type', 'total_capacity',
      'registration_enabled', 'waitlist_enabled', 'require_approval', 'custom_questions',
      'visibility', 'confirmation_message', 'cancellation_policy', 'organizer_name', 'organizer_email',
      'cover_image_url', 'category', 'tags'];

    for (const field of propagatableFields) {
      if ((updates as Record<string, unknown>)[field] !== undefined) {
        propagatable[field] = (updates as Record<string, unknown>)[field];
      }
    }

    let updatedInstances = 0;
    if (Object.keys(propagatable).length > 0) {
      updatedInstances = await updateFutureInstances(seriesId, propagatable);
    }

    let scheduleSync: { updated: number; created: number; deleted: number } | null = null;
    if (touchesSchedule) {
      const syncResult = await syncFutureSeriesInstances({
        seriesId,
        previousSeries: oldSeries,
        nextSeries: series,
      });

      if (syncResult.error) {
        return NextResponse.json({ error: syncResult.error }, { status: 409 });
      }

      scheduleSync = {
        updated: syncResult.updated,
        created: syncResult.created,
        deleted: syncResult.deleted,
      };
    }

    if (updates.ticket_types !== undefined) {
      const { data: futureUnmodifiedEvents } = await supabase
        .from('events')
        .select('id')
        .eq('series_id', seriesId)
        .eq('series_instance_modified', false)
        .gt('starts_at', new Date().toISOString());

      const ticketTemplates = parseSeriesTicketTemplates(series.ticket_types);
      for (const event of futureUnmodifiedEvents ?? []) {
        const { count: registrationCount } = await supabase
          .from('event_registrations')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', event.id)
          .neq('status', 'cancelled');

        if ((registrationCount ?? 0) > 0) {
          const { data: existingTicketTypes, error: ticketTypeError } = await supabase
            .from('event_ticket_types')
            .select('id')
            .eq('event_id', event.id)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });

          if (ticketTypeError || (existingTicketTypes?.length ?? 0) !== ticketTemplates.length) {
            return NextResponse.json(
              { error: 'Failed to safely update ticket templates for registered future instances.' },
              { status: 409 }
            );
          }

          for (const [index, template] of ticketTemplates.entries()) {
            const existingTicketType = existingTicketTypes?.[index];
            if (!existingTicketType) continue;

            const { error: updateTicketTypeError } = await supabase
              .from('event_ticket_types')
              .update({
                name: template.name,
                description: template.description,
                price_cents: template.price_cents,
                currency: template.currency,
                quantity_available: template.quantity_available,
                max_per_order: template.max_per_order,
                sort_order: template.sort_order,
                sales_start_at: template.sales_start_at,
                sales_end_at: template.sales_end_at,
                is_active: template.is_active,
                is_hidden: template.is_hidden,
              })
              .eq('id', existingTicketType.id)
              .eq('event_id', event.id);

            if (updateTicketTypeError) {
              return NextResponse.json(
                { error: 'Failed to update ticket templates for registered future instances.' },
                { status: 500 }
              );
            }
          }
          continue;
        }

        const { error: deleteTicketTypesError } = await supabase
          .from('event_ticket_types')
          .delete()
          .eq('event_id', event.id);

        if (deleteTicketTypesError) {
          return NextResponse.json({ error: 'Failed to replace future instance ticket templates.' }, { status: 500 });
        }

        if (ticketTemplates.length > 0) {
          const { error: insertTicketTypesError } = await supabase
            .from('event_ticket_types')
            .insert(ticketTemplates.map((template) => ({
              event_id: event.id,
              name: template.name,
              description: template.description,
              price_cents: template.price_cents,
              currency: template.currency,
              quantity_available: template.quantity_available,
              max_per_order: template.max_per_order,
              sort_order: template.sort_order,
              sales_start_at: template.sales_start_at,
              sales_end_at: template.sales_end_at,
              is_active: template.is_active,
              is_hidden: template.is_hidden,
            })));

          if (insertTicketTypesError) {
            return NextResponse.json({ error: 'Failed to replace future instance ticket templates.' }, { status: 500 });
          }
        }
      }
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.updated',
      entityType: 'event_series',
      entityId: seriesId,
      data: series as Record<string, unknown>,
      previousData: oldSeries as Record<string, unknown>,
    }).catch(err => console.error('Failed to emit automation event:', err));

    return NextResponse.json({
      series,
      updated_instances: updatedInstances,
      schedule_sync: scheduleSync,
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in PATCH series/[seriesId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, seriesId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'delete');

    const { error } = await supabase
      .from('event_series').delete().eq('id', seriesId).eq('project_id', project.id).select('id').single();

    if (error) {
      if (error.code === 'PGRST116') return NextResponse.json({ error: 'Series not found' }, { status: 404 });
      if (error.code === '23503') return NextResponse.json({ error: 'Cannot delete series: events in this series have existing registrations. Cancel or remove registrations first.' }, { status: 409 });
      console.error('Error deleting series:', error);
      return NextResponse.json({ error: 'Failed to delete series' }, { status: 500 });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.deleted',
      entityType: 'event_series',
      entityId: seriesId,
      data: { id: seriesId, project_id: project.id },
    }).catch(err => console.error('Failed to emit automation event:', err));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in DELETE series/[seriesId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

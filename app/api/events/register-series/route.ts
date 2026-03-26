import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { publicSeriesRegistrationSchema } from '@/lib/validators/event';
import { checkRateLimit } from '@/lib/calendar/service';
import { matchOrCreateContact } from '@/lib/calendar/crm-bridge';
import { autoEnrollInProgram } from '@/lib/events/service';
import { parseSeriesTicketTemplates } from '@/lib/events/series';
import { sendEventRegistrationConfirmation } from '@/lib/events/notifications';
import { createWaiversForRegistration } from '@/lib/events/waivers';
import { emitAutomationEvent } from '@/lib/automations/engine';

export async function POST(request: Request) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const validationResult = publicSeriesRegistrationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Validation failed', details: validationResult.error.flatten() }, { status: 400 });
    }

    const validated = validationResult.data;
    const normalizedEmail = validated.registrant_email.trim().toLowerCase();
    const normalizedPhone = validated.registrant_phone?.trim() || null;
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;

    if (ip) {
      const ipLimit = await checkRateLimit(`ip:${ip}`, 10, 60);
      if (!ipLimit.allowed) {
        return NextResponse.json({ error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' }, { status: 429 });
      }
    }

    const emailLimit = await checkRateLimit(`email:${normalizedEmail}`, 5, 1440);
    if (!emailLimit.allowed) {
      return NextResponse.json({ error: 'Too many registrations for this email. Please try again later.', code: 'RATE_LIMITED' }, { status: 429 });
    }

    const { data: series } = await supabase
      .from('event_series')
      .select('id, project_id, program_id, title, ticket_types, status, created_by')
      .eq('id', validated.series_id)
      .single();

    if (!series || series.status !== 'active') {
      return NextResponse.json({ error: 'Series not found', code: 'SERIES_NOT_FOUND' }, { status: 404 });
    }

    const ticketTemplates = parseSeriesTicketTemplates(series.ticket_types);
    const templateMap = new Map(ticketTemplates.map((template) => [template.id, template]));
    const invalidSelection = validated.ticket_selections.find((selection) => !templateMap.has(selection.ticket_type_id));
    if (invalidSelection) {
      return NextResponse.json({ error: 'Invalid ticket type', code: 'INVALID_TICKET_TYPE' }, { status: 400 });
    }

    const selections = validated.ticket_selections
      .filter((selection) => selection.quantity > 0)
      .map((selection) => ({
        ticket_type_id: selection.ticket_type_id,
        quantity: selection.quantity,
      }));

    if (selections.length === 0) {
      return NextResponse.json({ error: 'At least one ticket is required', code: 'INVALID_INPUT' }, { status: 400 });
    }

    const { data: futureEvents } = await supabase
      .from('events')
      .select('id, starts_at, title')
      .eq('series_id', validated.series_id)
      .eq('status', 'published')
      .gt('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true });

    if (!futureEvents || futureEvents.length === 0) {
      return NextResponse.json({ error: 'There are no future published instances for this series', code: 'NO_FUTURE_INSTANCES' }, { status: 409 });
    }

    const storedResponses = {
      ...(validated.responses ?? {}),
      ticket_selections: selections,
    };

    const { data: seriesRegistration, error: seriesRegistrationError } = await supabase
      .from('event_series_registrations')
      .insert({
        series_id: validated.series_id,
        registrant_name: validated.registrant_name,
        registrant_email: normalizedEmail,
        registrant_phone: normalizedPhone,
        responses: storedResponses as unknown as import('@/types/database').Json,
        source: 'web',
      })
      .select()
      .single();

    if (seriesRegistrationError || !seriesRegistration) {
      console.error('Failed to create series registration:', seriesRegistrationError);
      return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
    }

    const failedInstances: Array<{ event_id: string; starts_at: string; error: string }> = [];
    const successfulRegistrationIds: string[] = [];
    const eventMetadataById = new Map(futureEvents.map((event) => [
      event.id,
      { title: event.title },
    ]));

    for (const event of futureEvents) {
      const { data: eventTicketTypes } = await supabase
        .from('event_ticket_types')
        .select('id, name, sort_order')
        .eq('event_id', event.id);

      const mappedSelections = selections.flatMap((selection) => {
        const template = templateMap.get(selection.ticket_type_id);
        if (!template) return [];
        const eventTicketType = (eventTicketTypes ?? []).find((ticketType) =>
          ticketType.name === template.name && ticketType.sort_order === template.sort_order
        );
        if (!eventTicketType) return [];

        return [{
          ticket_type_id: eventTicketType.id,
          quantity: selection.quantity,
        }];
      });

      if (mappedSelections.length === 0) {
        failedInstances.push({
          event_id: event.id,
          starts_at: event.starts_at,
          error: 'No matching ticket types found on this instance',
        });
        continue;
      }

      const { data: registrationId, error: rpcError } = await supabase.rpc('register_for_event', {
        p_event_id: event.id,
        p_registrant_name: validated.registrant_name,
        p_registrant_email: normalizedEmail,
        p_registrant_phone: normalizedPhone ?? '',
        p_ticket_selections: mappedSelections as unknown as import('@/types/database').Json,
        p_responses: (validated.responses ?? {}) as unknown as import('@/types/database').Json,
        p_source: 'web',
        p_ip_address: ip ?? '',
        p_user_agent: request.headers.get('user-agent') ?? '',
      });

      if (rpcError || !registrationId) {
        failedInstances.push({
          event_id: event.id,
          starts_at: event.starts_at,
          error: rpcError?.message || 'Registration failed',
        });
        continue;
      }

      const registrationIdString = registrationId as string;
      successfulRegistrationIds.push(registrationIdString);
      const { error: linkError } = await supabase
        .from('event_registrations')
        .update({ series_registration_id: seriesRegistration.id })
        .eq('id', registrationIdString);
      if (linkError) {
        console.error('Failed to link registration to series:', registrationIdString, linkError.message);
      }

      sendEventRegistrationConfirmation(registrationIdString).catch((error) =>
        console.error('Failed to send series registration confirmation:', error)
      );
    }

    if (successfulRegistrationIds.length === 0) {
      await supabase
        .from('event_series_registrations')
        .delete()
        .eq('id', seriesRegistration.id);

      return NextResponse.json({
        error: 'Unable to register for any future instances in this series',
        code: 'SERIES_REGISTRATION_FAILED',
        failedInstances,
      }, { status: 409 });
    }

    let personId: string | null = null;
    const { data: memberships } = await supabase
      .from('project_memberships')
      .select('user_id, role')
      .eq('project_id', series.project_id)
      .in('role', ['owner', 'admin']);

    const ownerOrAdmin = (memberships ?? []).sort((a, b) => {
      const priority: Record<string, number> = { owner: 0, admin: 1 };
      return (priority[a.role] ?? 99) - (priority[b.role] ?? 99);
    })[0];
    const createdBy = ownerOrAdmin?.user_id ?? series.created_by ?? null;

    if (ownerOrAdmin) {
      try {
        const result = await matchOrCreateContact(
          normalizedEmail,
          validated.registrant_name,
          normalizedPhone,
          series.project_id,
          ownerOrAdmin.user_id,
          supabase
        );
        personId = result.personId;
      } catch (crmError) {
        console.error('Series CRM contact creation error:', crmError);
      }
    }

    if (personId) {
      const { error: seriesPersonErr } = await supabase
        .from('event_series_registrations')
        .update({ person_id: personId })
        .eq('id', seriesRegistration.id);
      if (seriesPersonErr) {
        console.error('Failed to link person to series registration:', seriesPersonErr.message);
      }

      if (successfulRegistrationIds.length > 0) {
        const { error: regPersonErr } = await supabase
          .from('event_registrations')
          .update({ person_id: personId })
          .in('id', successfulRegistrationIds);
        if (regPersonErr) {
          console.error('Failed to link person to event registrations:', regPersonErr.message);
        }
      }

      if (series.program_id) {
        autoEnrollInProgram(personId, series.program_id, series.project_id).catch((err) =>
          console.error('Failed to auto-enroll series registrant in program:', err)
        );
      }
    }

    const { data: createdRegistrations } = successfulRegistrationIds.length > 0
      ? await supabase
        .from('event_registrations')
        .select('id, event_id, status')
        .in('id', successfulRegistrationIds)
      : { data: [] as Array<{ id: string; event_id: string; status: string }> };

    if (createdBy) {
      for (const registration of createdRegistrations ?? []) {
        if (registration.status !== 'pending_waiver') continue;

        const eventMetadata = eventMetadataById.get(registration.event_id);
        if (!eventMetadata) continue;

        createWaiversForRegistration({
          supabase,
          adminClient: supabase,
          projectId: series.project_id,
          eventId: registration.event_id,
          eventTitle: eventMetadata.title,
          registrationId: registration.id,
          personId,
          registrantName: validated.registrant_name,
          registrantEmail: normalizedEmail,
          createdBy,
        }).catch((err) => console.error('Failed to create event waivers for series registration:', err));
      }
    }

    for (const registration of createdRegistrations ?? []) {
      emitAutomationEvent({
        projectId: series.project_id,
        triggerType: 'event.registration.created',
        entityType: 'event_registration',
        entityId: registration.id,
        data: {
          event_id: registration.event_id,
          series_id: validated.series_id,
          series_registration_id: seriesRegistration.id,
          registrant_name: validated.registrant_name,
          registrant_email: normalizedEmail,
        },
      }).catch((err) => console.error('Failed to emit automation event:', err));
    }

    return NextResponse.json({
      seriesRegistration: {
        id: seriesRegistration.id,
        cancel_token: seriesRegistration.cancel_token,
        status: seriesRegistration.status,
      },
      instanceCount: successfulRegistrationIds.length,
      failedInstances,
    }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/events/register-series:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

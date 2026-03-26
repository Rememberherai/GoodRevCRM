import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { publicEventRegistrationSchema } from '@/lib/validators/event';
import { checkRateLimit } from '@/lib/calendar/service';
import { matchOrCreateContact } from '@/lib/calendar/crm-bridge';
import { sendEventRegistrationConfirmation } from '@/lib/events/notifications';
import { autoEnrollInProgram } from '@/lib/events/service';
import { createWaiversForRegistration } from '@/lib/events/waivers';
import { emitAutomationEvent } from '@/lib/automations/engine';

export async function POST(request: Request) {
  try {
    const supabase = createServiceClient();

    const body = await request.json();
    const validationResult = publicEventRegistrationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Validation failed', details: validationResult.error.flatten() }, { status: 400 });
    }

    const validated = validationResult.data;
    const normalizedEmail = validated.registrant_email.trim().toLowerCase();
    const normalizedPhone = validated.registrant_phone?.trim() || null;

    // Rate limiting
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

    // Call register_for_event RPC (atomic capacity check + insert)
    const { data: registrationId, error: rpcError } = await supabase.rpc('register_for_event', {
      p_event_id: validated.event_id,
      p_registrant_name: validated.registrant_name,
      p_registrant_email: normalizedEmail,
      p_registrant_phone: normalizedPhone ?? '',
      p_ticket_selections: validated.ticket_selections as unknown as import('@/types/database').Json,
      p_responses: (validated.responses ?? {}) as unknown as import('@/types/database').Json,
      p_source: 'web',
      p_ip_address: ip ?? '',
      p_user_agent: request.headers.get('user-agent') ?? '',
    });

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('CAPACITY_FULL')) return NextResponse.json({ error: 'This event is at full capacity', code: 'CAPACITY_FULL' }, { status: 409 });
      if (msg.includes('TICKET_SOLD_OUT')) return NextResponse.json({ error: msg.split(': ').slice(1).join(': '), code: 'TICKET_SOLD_OUT' }, { status: 409 });
      if (msg.includes('REGISTRATION_CLOSED')) return NextResponse.json({ error: 'Registration is closed', code: 'REGISTRATION_CLOSED' }, { status: 410 });
      if (msg.includes('EVENT_NOT_FOUND')) return NextResponse.json({ error: 'Event not found', code: 'EVENT_NOT_FOUND' }, { status: 404 });
      if (msg.includes('INVALID_TICKET_TYPE')) return NextResponse.json({ error: 'Invalid ticket type', code: 'INVALID_TICKET_TYPE' }, { status: 400 });
      if (msg.includes('INVALID_INPUT')) return NextResponse.json({ error: msg.split(': ').slice(1).join(': '), code: 'INVALID_INPUT' }, { status: 400 });
      console.error('register_for_event RPC error:', rpcError);
      return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
    }

    const regId = registrationId as unknown as string;

    if (!regId) {
      console.error('register_for_event RPC returned null without error');
      return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
    }

    // Fetch registration tokens and event details
    const [regResult, eventResult] = await Promise.all([
      supabase
        .from('event_registrations')
        .select('confirmation_token, cancel_token, status')
        .eq('id', regId)
        .single(),
      supabase
        .from('events')
        .select('id, project_id, program_id, add_to_crm, title, starts_at, created_by')
        .eq('id', validated.event_id)
        .single(),
    ]);

    const registration = regResult.data;
    const event = eventResult.data;

    if (!registration) {
      console.error('Failed to fetch registration after RPC:', regResult.error);
      return NextResponse.json({ error: 'Registration created but failed to fetch details' }, { status: 500 });
    }

    // Side effects (fire-and-forget)
    if (event) {
      let matchedPersonId: string | null = null;

      const { data: memberships } = await supabase
        .from('project_memberships')
        .select('user_id, role')
        .eq('project_id', event.project_id)
        .in('role', ['owner', 'admin']);

      const ownerOrAdmin = (memberships ?? []).sort((a, b) => {
        const priority: Record<string, number> = { owner: 0, admin: 1 };
        return (priority[a.role] ?? 99) - (priority[b.role] ?? 99);
      })[0];
      const createdBy = ownerOrAdmin?.user_id ?? event.created_by ?? null;

      // CRM contact creation
      if (event.add_to_crm) {
        try {
          if (ownerOrAdmin) {
            const { personId } = await matchOrCreateContact(
              normalizedEmail,
              validated.registrant_name,
              normalizedPhone,
              event.project_id,
              ownerOrAdmin.user_id,
              supabase
            );

            // Update registration with person_id
            if (personId) {
              matchedPersonId = personId;
              const { error: personLinkErr } = await supabase
                .from('event_registrations')
                .update({ person_id: personId })
                .eq('id', regId);
              if (personLinkErr) {
                console.error('Failed to link person to registration:', personLinkErr.message);
              }

              // Auto-enroll in program if linked
              if (event.program_id) {
                autoEnrollInProgram(personId, event.program_id, event.project_id).catch(err =>
                  console.error('Failed to auto-enroll in program:', err)
                );
              }
            }
          }
        } catch (crmError) {
          console.error('CRM contact creation error:', crmError);
        }
      }

      if (registration.status === 'pending_waiver' && createdBy) {
        createWaiversForRegistration({
          supabase,
          adminClient: supabase,
          projectId: event.project_id,
          eventId: event.id,
          eventTitle: event.title,
          registrationId: regId,
          personId: matchedPersonId,
          registrantName: validated.registrant_name,
          registrantEmail: normalizedEmail,
          createdBy,
        }).catch((err) => console.error('Failed to create event waivers:', err));
      }

      // Confirmation email + in-app notification
      sendEventRegistrationConfirmation(regId).catch(err =>
        console.error('Failed to send registration confirmation:', err)
      );

      // Automation event
      emitAutomationEvent({
        projectId: event.project_id,
        triggerType: 'event.registration.created',
        entityType: 'event_registration',
        entityId: regId,
        data: {
          event_id: validated.event_id,
          registrant_name: validated.registrant_name,
          registrant_email: normalizedEmail,
          status: registration.status,
        },
      }).catch(err => console.error('Failed to emit automation event:', err));
    }

    return NextResponse.json({
      registration: {
        id: regId,
        status: registration.status,
        confirmation_token: registration.confirmation_token,
        cancel_token: registration.cancel_token,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/events/register:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

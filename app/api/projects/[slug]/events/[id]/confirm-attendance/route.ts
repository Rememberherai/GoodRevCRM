import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { bridgeCheckInToAttendance } from '@/lib/events/service';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

const confirmAttendanceSchema = z.object({
  confirmations: z.array(z.object({
    raw_text: z.string(),
    person_id: z.string().uuid().nullable().optional(),
    create_new: z.boolean().default(false),
    email: z.string().nullable().optional().transform(v => {
      if (!v) return null;
      // Only keep if it looks like a valid email; silently discard partial input
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
    }),
    phone: z.string().max(30).nullable().optional().transform(v => v || null),
  })).min(1),
});

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

    const { data: event } = await supabase
      .from('events').select('id, starts_at').eq('id', id).eq('project_id', project.id).single();
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const body = await request.json();
    const validationResult = confirmAttendanceSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Validation failed', details: validationResult.error.flatten() }, { status: 400 });
    }

    const { confirmations } = validationResult.data;
    const serviceClient = createServiceClient();
    const now = new Date().toISOString();
    let processed = 0;

    let fallbackTicketTypeId: string | null = null;
    const loadFallbackTicketType = async () => {
      if (fallbackTicketTypeId) return fallbackTicketTypeId;

      const { data: existingTicketType } = await supabase
        .from('event_ticket_types')
        .select('id')
        .eq('event_id', id)
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (existingTicketType?.id) {
        fallbackTicketTypeId = existingTicketType.id;
        return fallbackTicketTypeId;
      }

      const { data: createdTicketType, error: createTicketTypeError } = await supabase
        .from('event_ticket_types')
        .insert({
          event_id: id,
          name: 'Walk-in',
          description: 'Auto-created for manual attendance confirmation',
          quantity_available: null,
          max_per_order: 1,
          sort_order: 999,
          is_active: true,
          is_hidden: true,
        })
        .select('id')
        .single();

      if (createTicketTypeError || !createdTicketType?.id) {
        console.error('Failed to create fallback ticket type for manual attendance:', createTicketTypeError?.message);
        return null;
      }

      fallbackTicketTypeId = createdTicketType.id;
      return fallbackTicketTypeId;
    };

    for (const confirmation of confirmations) {
      let personId = confirmation.person_id || null;

      // Create new person if requested
      if (confirmation.create_new && !personId) {
        try {
          const nameParts = confirmation.raw_text.trim().split(/\s+/);
          const firstName = nameParts[0] || confirmation.raw_text;
          const lastName = nameParts.slice(1).join(' ') || '';

          // Create person directly (not via matchOrCreateContact which requires email)
          const { data: newPerson, error: personError } = await serviceClient
            .from('people')
            .insert({
              project_id: project.id,
              first_name: firstName,
              last_name: lastName || '(unknown)',
              created_by: user.id,
              email: confirmation.email ?? null,
              phone: confirmation.phone ?? null,
            })
            .select('id')
            .single();

          if (personError || !newPerson) {
            console.error('Failed to create person for scanned name:', confirmation.raw_text, personError?.message);
            continue;
          }
          personId = newPerson.id;
        } catch (err) {
          console.error('Failed to create person for scanned name:', confirmation.raw_text, err);
          continue;
        }
      }

      if (!personId) continue;

      // Update matched person with new email/phone from scan if they don't have one
      if (!confirmation.create_new && (confirmation.email || confirmation.phone)) {
        const { data: existingPerson } = await serviceClient
          .from('people')
          .select('email, phone, mobile_phone')
          .eq('id', personId)
          .single();

        if (existingPerson) {
          const updates: Record<string, string> = {};
          if (confirmation.email && !existingPerson.email) updates.email = confirmation.email;
          if (confirmation.phone && !existingPerson.phone && !existingPerson.mobile_phone) updates.phone = confirmation.phone;
          if (Object.keys(updates).length > 0) {
            await serviceClient.from('people').update(updates).eq('id', personId).eq('project_id', project.id);
          }
        }
      }

      // Create registration with source 'manual' and mark as checked in
      const { data: reg } = await supabase
        .from('event_registrations')
        .select('id, registrant_email, registrant_name, status')
        .eq('event_id', id)
        .eq('person_id', personId)
        .in('status', ['confirmed', 'pending_approval', 'pending_waiver'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (reg) {
        // Update existing registration
        const { error: updateErr } = await supabase
          .from('event_registrations')
          .update({ checked_in_at: now, checked_in_by: user.id })
          .eq('id', reg.id);
        if (updateErr) {
          console.error('Failed to update registration check-in:', updateErr.message);
          continue;
        }

        const { count: ticketCount } = await supabase
          .from('event_registration_tickets')
          .select('id', { count: 'exact', head: true })
          .eq('registration_id', reg.id);

        if ((ticketCount ?? 0) === 0) {
          const ticketTypeId = await loadFallbackTicketType();
          if (!ticketTypeId) continue;

          const { error: ticketInsertErr } = await supabase
            .from('event_registration_tickets')
            .insert({
              registration_id: reg.id,
              ticket_type_id: ticketTypeId,
              attendee_name: reg.registrant_name,
              attendee_email: reg.registrant_email,
              checked_in_at: now,
            });

          if (ticketInsertErr) {
            console.error('Failed to create fallback ticket for existing manual registration:', ticketInsertErr.message);
            continue;
          }
        } else {
          await supabase
            .from('event_registration_tickets')
            .update({ checked_in_at: now })
            .eq('registration_id', reg.id);
        }
      } else {
        // Create new registration
        const { data: person } = await serviceClient
          .from('people')
          .select('email, first_name, last_name')
          .eq('id', personId)
          .maybeSingle();

        const registrantEmail = person?.email || `${personId}@manual-registration.local`;

        const { data: insertedRegistration, error: insertErr } = await supabase
          .from('event_registrations')
          .insert({
            event_id: id,
            person_id: personId,
            registrant_name: person ? [person.first_name, person.last_name].filter(Boolean).join(' ').trim() || confirmation.raw_text : confirmation.raw_text,
            registrant_email: registrantEmail,
            status: 'confirmed',
            checked_in_at: now,
            checked_in_by: user.id,
            waiver_status: 'not_required',
            source: 'manual',
          })
          .select('id, registrant_name, registrant_email')
          .single();

        if (insertErr || !insertedRegistration) {
          console.error('Failed to create manual registration:', insertErr?.message);
          continue;
        }

        const ticketTypeId = await loadFallbackTicketType();
        if (!ticketTypeId) continue;

        const { error: ticketInsertErr } = await supabase
          .from('event_registration_tickets')
          .insert({
            registration_id: insertedRegistration.id,
            ticket_type_id: ticketTypeId,
            attendee_name: insertedRegistration.registrant_name,
            attendee_email: insertedRegistration.registrant_email,
            checked_in_at: now,
          });

        if (ticketInsertErr) {
          console.error('Failed to create manual registration ticket:', ticketInsertErr.message);
          continue;
        }
      }

      // Bridge to program attendance
      bridgeCheckInToAttendance(id, personId).catch(err =>
        console.error('Failed to bridge attendance:', err)
      );

      processed++;
    }

    return NextResponse.json({ success: true, processed });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in POST confirm-attendance:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { promoteFromWaitlist } from '@/lib/events/service';
import { sendEventCancellationConfirmation, sendWaitlistPromotionNotification } from '@/lib/events/notifications';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { z } from 'zod';

const cancelSchema = z.object({
  cancel_token: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const supabase = createServiceClient();

    const body = await request.json();
    const validationResult = cancelSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { cancel_token } = validationResult.data;

    // Check event_registrations first
    const { data: registration } = await supabase
      .from('event_registrations')
      .select('id, event_id, status, checked_in_at, registrant_name, registrant_email, events(project_id)')
      .eq('cancel_token', cancel_token)
      .single();

    if (registration) {
      if (registration.status === 'cancelled') {
        return NextResponse.json({ error: 'Registration is already cancelled' }, { status: 400 });
      }
      if (registration.checked_in_at) {
        return NextResponse.json({ error: 'Checked-in registrations cannot be cancelled online' }, { status: 409 });
      }

      const { error } = await supabase
        .from('event_registrations')
        .update({ status: 'cancelled' })
        .eq('id', registration.id);

      if (error) {
        console.error('Error cancelling registration:', error);
        return NextResponse.json({ error: 'Failed to cancel registration' }, { status: 500 });
      }

      // Fire-and-forget side effects
      sendEventCancellationConfirmation(registration.id).catch(err =>
        console.error('Failed to send cancellation email:', err)
      );

      // Promote from waitlist (fire-and-forget)
      promoteFromWaitlist(registration.event_id).then(promotedId => {
        if (promotedId) {
          sendWaitlistPromotionNotification(promotedId).catch(err =>
            console.error('Failed to send waitlist promotion notification:', err)
          );
        }
      }).catch(err => console.error('Failed to promote from waitlist:', err));

      // Emit automation event
      const projectId = (registration.events as unknown as { project_id: string })?.project_id;
      if (projectId) {
        emitAutomationEvent({
          projectId,
          triggerType: 'event.registration.cancelled',
          entityType: 'event_registration',
          entityId: registration.id,
          data: {
            event_id: registration.event_id,
            registrant_name: registration.registrant_name,
            registrant_email: registration.registrant_email,
          },
        }).catch(err => console.error('Failed to emit automation event:', err));
      }

      return NextResponse.json({ success: true, type: 'single' });
    }

    // Check series registrations
    const { data: seriesReg } = await supabase
      .from('event_series_registrations')
      .select('id, series_id, status')
      .eq('cancel_token', cancel_token)
      .single();

    if (seriesReg) {
      if (seriesReg.status === 'cancelled') {
        return NextResponse.json({ error: 'Series registration is already cancelled' }, { status: 400 });
      }

      // Cancel series registration
      const { error: cancelError } = await supabase
        .from('event_series_registrations')
        .update({ status: 'cancelled' })
        .eq('id', seriesReg.id);

      if (cancelError) {
        console.error('Failed to cancel series registration:', cancelError.message);
        return NextResponse.json({ error: 'Failed to cancel series registration' }, { status: 500 });
      }

      // Cancel all future instance registrations
      const now = new Date().toISOString();
      const { data: futureRegs, error: futureRegsError } = await supabase
        .from('event_registrations')
        .select('id, event_id, registrant_name, registrant_email, events!inner(starts_at, project_id)')
        .eq('series_registration_id', seriesReg.id)
        .neq('status', 'cancelled')
        .is('checked_in_at', null)
        .gt('events.starts_at', now);

      if (futureRegsError) {
        console.error('Failed to fetch future registrations for series cancellation:', futureRegsError.message);
      }

      if (futureRegs) {
        for (const reg of futureRegs) {
          const { error: cancelRegErr } = await supabase
            .from('event_registrations')
            .update({ status: 'cancelled' })
            .eq('id', reg.id);

          if (cancelRegErr) {
            console.error('Failed to cancel instance registration:', reg.id, cancelRegErr.message);
            continue;
          }

          sendEventCancellationConfirmation(reg.id).catch(err =>
            console.error('Failed to send cancellation email for series instance:', err)
          );

          const projectId = (reg.events as unknown as { project_id?: string })?.project_id;
          if (projectId) {
            emitAutomationEvent({
              projectId,
              triggerType: 'event.registration.cancelled',
              entityType: 'event_registration',
              entityId: reg.id,
              data: {
                event_id: reg.event_id,
                registrant_name: reg.registrant_name,
                registrant_email: reg.registrant_email,
                source: 'series_cancellation',
              },
            }).catch(err => console.error('Failed to emit automation event for series cancellation:', err));
          }

          promoteFromWaitlist(reg.event_id).then(promotedId => {
            if (promotedId) {
              sendWaitlistPromotionNotification(promotedId).catch(err =>
                console.error('Failed to send waitlist promotion notification:', err)
              );
            }
          }).catch(err => console.error('Failed to promote from waitlist:', err));
        }
      }

      return NextResponse.json({ success: true, type: 'series', cancelled_count: futureRegs?.length ?? 0 });
    }

    return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
  } catch (error) {
    console.error('Error in POST /api/events/cancel:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Event notification service — email confirmations, cancellations, waitlist promotions.
 *
 * Uses existing Gmail service for email delivery.
 * All functions are fire-and-forget safe (errors logged, never thrown).
 */

import { createServiceClient } from '@/lib/supabase/server';
import { generateIcs } from '@/lib/calendar/ics';
import type { GmailConnection } from '@/types/gmail';

// ============================================================
// Helpers
// ============================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateTime(isoDate: string, timezone?: string | null): string {
  const tz = timezone || 'America/Denver';
  return new Date(isoDate).toLocaleString('en-US', {
    timeZone: tz,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function formatGCalDate(isoDate: string): string {
  return new Date(isoDate).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function buildGoogleCalendarUrl(params: {
  title: string;
  startsAt: string;
  endsAt: string;
  description?: string | null;
  location: string;
}) {
  const query = new URLSearchParams({
    action: 'TEMPLATE',
    text: params.title,
    dates: `${formatGCalDate(params.startsAt)}/${formatGCalDate(params.endsAt)}`,
    details: params.description ?? '',
    location: params.location,
  });

  return `https://calendar.google.com/calendar/render?${query.toString()}`;
}

function buildTokenIcsUrl(confirmationToken?: string | null) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl || !confirmationToken) return null;
  return `${appUrl}/api/events/ics?token=${encodeURIComponent(confirmationToken)}`;
}

function buildIcsAttachment(icsContent: string) {
  return {
    filename: 'event.ics',
    mimeType: 'text/calendar; charset=utf-8',
    content: Buffer.from(icsContent, 'utf-8').toString('base64'),
  };
}

// ============================================================
// Gmail connection lookup for project-scoped events
// ============================================================

interface ProjectGmailConnection {
  gmailConnection: GmailConnection;
  userId: string;
}

/**
 * Find a Gmail connection from a project member (prefer owner, then admin).
 * Returns null if no connection found (emails will be skipped).
 */
export async function getProjectGmailConnection(
  projectId: string
): Promise<ProjectGmailConnection | null> {
  const supabase = createServiceClient();

  // Query gmail connections for project members, preferring owner then admin
  const { data: connections, error: connError } = await supabase
    .from('gmail_connections')
    .select(`
      *,
      users!inner(
        id,
        project_memberships!inner(
          project_id,
          role
        )
      )
    `)
    .eq('users.project_memberships.project_id', projectId)
    .in('users.project_memberships.role', ['owner', 'admin'])
    .eq('status', 'connected')
    .limit(5);

  if (connError) {
    console.error('Failed to fetch Gmail connections:', connError.message);
    return null;
  }

  if (!connections || connections.length === 0) return null;

  // Sort by role priority: owner > admin > others
  const rolePriority: Record<string, number> = { owner: 0, admin: 1 };
  const sorted = connections.sort((a, b) => {
    const aRole = (a.users as unknown as { project_memberships: { role: string }[] })
      ?.project_memberships?.[0]?.role || 'viewer';
    const bRole = (b.users as unknown as { project_memberships: { role: string }[] })
      ?.project_memberships?.[0]?.role || 'viewer';
    return (rolePriority[aRole] ?? 99) - (rolePriority[bRole] ?? 99);
  });

  const best = sorted[0];
  if (!best) return null;
  return {
    gmailConnection: best as unknown as GmailConnection,
    userId: best.user_id,
  };
}

// ============================================================
// Confirmation email
// ============================================================

/**
 * Send event registration confirmation email with ICS attachment.
 * Also creates an in-app notification for the project admin.
 * Fire-and-forget safe.
 */
export async function sendEventRegistrationConfirmation(
  registrationId: string
): Promise<void> {
  const supabase = createServiceClient();

  try {
    // Load registration with event and calendar settings
    const { data: registration } = await supabase
      .from('event_registrations')
      .select('*, events(*)')
      .eq('id', registrationId)
      .single();

    if (!registration || !registration.events) {
      console.error('sendEventRegistrationConfirmation: registration or event not found');
      return;
    }

    const event = registration.events as unknown as {
      id: string;
      project_id: string;
      title: string;
      description: string | null;
      slug: string | null;
      starts_at: string;
      ends_at: string;
      timezone: string;
      venue_name: string | null;
      venue_address: string | null;
      virtual_url: string | null;
      location_type: string;
      organizer_name: string | null;
      organizer_email: string | null;
      confirmation_message: string | null;
    };

    // Find Gmail connection for this project
    const gmailInfo = await getProjectGmailConnection(event.project_id);
    if (!gmailInfo) {
      console.warn('sendEventRegistrationConfirmation: no Gmail connection for project', event.project_id);
      return;
    }

    // Build location string
    const location = event.location_type === 'virtual'
      ? event.virtual_url || 'Virtual'
      : [event.venue_name, event.venue_address].filter(Boolean).join(', ') || 'TBD';
    const googleCalendarUrl = buildGoogleCalendarUrl({
      title: event.title,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      description: event.description ?? `Registration confirmation for ${event.title}`,
      location,
    });
    const icsUrl = buildTokenIcsUrl(registration.confirmation_token);

    // Generate ICS
    const icsContent = generateIcs({
      uid: registration.id,
      summary: event.title,
      description: `Registration confirmation for ${event.title}`,
      location,
      startAt: event.starts_at,
      endAt: event.ends_at,
      organizerName: event.organizer_name || undefined,
      organizerEmail: event.organizer_email || undefined,
      attendeeName: registration.registrant_name,
      attendeeEmail: registration.registrant_email,
    });

    // Build confirmation HTML
    const statusMessage = registration.status === 'confirmed'
      ? 'Your registration is confirmed!'
      : registration.status === 'waitlisted'
        ? 'You have been placed on the waitlist. We\'ll notify you if a spot opens up.'
        : registration.status === 'pending_approval'
          ? 'Your registration is pending approval. We\'ll notify you once approved.'
          : registration.status === 'pending_waiver'
            ? 'Your registration is pending waiver completion. Please check your email to sign the required waiver.'
            : 'Your registration has been received.';

    const cancelUrl = registration.cancel_token
      ? `${process.env.NEXT_PUBLIC_APP_URL || ''}/events/cancel/${registration.cancel_token}`
      : null;

    const bodyHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${escapeHtml(event.title)}</h2>
        <p>${statusMessage}</p>
        <table style="margin: 16px 0; border-collapse: collapse;">
          <tr><td style="padding: 4px 16px 4px 0; color: #666;">When</td><td>${escapeHtml(formatDateTime(event.starts_at, event.timezone))}</td></tr>
          <tr><td style="padding: 4px 16px 4px 0; color: #666;">Where</td><td>${escapeHtml(location)}</td></tr>
          <tr><td style="padding: 4px 16px 4px 0; color: #666;">Name</td><td>${escapeHtml(registration.registrant_name)}</td></tr>
          <tr><td style="padding: 4px 16px 4px 0; color: #666;">Email</td><td>${escapeHtml(registration.registrant_email)}</td></tr>
        </table>
        ${event.confirmation_message ? `<p>${escapeHtml(event.confirmation_message)}</p>` : ''}
        <p style="margin: 24px 0;">
          <a href="${googleCalendarUrl}" style="background-color: #2563eb; color: white; padding: 12px 20px; text-decoration: none; border-radius: 6px; display: inline-block; margin-right: 12px;">
            Add to Google Calendar
          </a>
          ${icsUrl ? `<a href="${icsUrl}" style="color: #2563eb;">Download .ics</a>` : ''}
        </p>
        ${registration.status === 'confirmed' ? `<p style="margin-top: 16px;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/events/confirmation/${registration.confirmation_token}" style="color: #2563eb; font-size: 13px;">View your tickets &amp; QR codes for check-in →</a>
        </p>` : ''}
        ${cancelUrl ? `<p style="margin-top: 24px;">
          <a href="${cancelUrl}" style="color: #666; font-size: 12px;">Cancel registration</a>
        </p>` : ''}
      </div>
    `;

    const ticketUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/events/confirmation/${registration.confirmation_token}`;

    // Send email
    const { sendEmail } = await import('@/lib/gmail/service');
    await sendEmail(
      gmailInfo.gmailConnection,
      {
        to: registration.registrant_email,
        subject: `Registration: ${event.title}`,
        body_html: bodyHtml,
        body_text: `${statusMessage}\n\nEvent: ${event.title}\nWhen: ${formatDateTime(event.starts_at, event.timezone)}\nWhere: ${location}\n${registration.status === 'confirmed' ? `View your tickets: ${ticketUrl}\n` : ''}Google Calendar: ${googleCalendarUrl}${icsUrl ? `\nICS Download: ${icsUrl}` : ''}${cancelUrl ? `\nCancel: ${cancelUrl}` : ''}`,
        attachments: [buildIcsAttachment(icsContent)],
      },
      gmailInfo.userId,
      event.project_id
    );

    // Create in-app notification for project admin
    await supabase.from('notifications').insert({
      user_id: gmailInfo.userId,
      project_id: event.project_id,
      type: 'event_registration',
      title: 'New Event Registration',
      message: `${registration.registrant_name} registered for ${event.title}`,
      entity_type: 'event_registration',
      entity_id: registration.id,
    });
  } catch (err) {
    console.error('sendEventRegistrationConfirmation error:', err);
  }
}

// ============================================================
// Cancellation email
// ============================================================

export async function sendEventCancellationConfirmation(
  registrationId: string
): Promise<void> {
  const supabase = createServiceClient();

  try {
    const { data: registration } = await supabase
      .from('event_registrations')
      .select('*, events(*)')
      .eq('id', registrationId)
      .single();

    if (!registration || !registration.events) return;

    const event = registration.events as unknown as {
      project_id: string;
      title: string;
      starts_at: string;
      timezone: string;
    };

    const gmailInfo = await getProjectGmailConnection(event.project_id);
    if (!gmailInfo) return;

    const bodyHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Registration Cancelled</h2>
        <p>Your registration for <strong>${escapeHtml(event.title)}</strong> on ${escapeHtml(formatDateTime(event.starts_at, event.timezone))} has been cancelled.</p>
      </div>
    `;

    const { sendEmail } = await import('@/lib/gmail/service');
    await sendEmail(
      gmailInfo.gmailConnection,
      {
        to: registration.registrant_email,
        subject: `Cancelled: ${event.title}`,
        body_html: bodyHtml,
        body_text: `Your registration for ${event.title} has been cancelled.`,
      },
      gmailInfo.userId,
      event.project_id
    );
  } catch (err) {
    console.error('sendEventCancellationConfirmation error:', err);
  }
}

// ============================================================
// Waitlist promotion notification
// ============================================================

export async function sendWaitlistPromotionNotification(
  registrationId: string
): Promise<void> {
  const supabase = createServiceClient();

  try {
    const { data: registration } = await supabase
      .from('event_registrations')
      .select('*, events(*)')
      .eq('id', registrationId)
      .single();

    if (!registration || !registration.events) return;

    const event = registration.events as unknown as {
      id: string;
      project_id: string;
      title: string;
      description: string | null;
      starts_at: string;
      ends_at: string;
      timezone: string;
      venue_name: string | null;
      venue_address: string | null;
      virtual_url: string | null;
      location_type: string;
      organizer_name: string | null;
      organizer_email: string | null;
    };

    const gmailInfo = await getProjectGmailConnection(event.project_id);
    if (!gmailInfo) return;

    const location = event.location_type === 'virtual'
      ? event.virtual_url || 'Virtual'
      : [event.venue_name, event.venue_address].filter(Boolean).join(', ') || 'TBD';

    const isPendingWaiver = registration.status === 'pending_waiver';
    const headline = isPendingWaiver ? 'Spot Available' : 'You\'re In!';
    const intro = isPendingWaiver
      ? 'A spot opened up for this event. Complete the required waiver to finish confirming your registration.'
      : 'A spot opened up for this event and your registration has been confirmed.';
    const googleCalendarUrl = buildGoogleCalendarUrl({
      title: event.title,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      description: event.description ?? intro,
      location,
    });
    const icsUrl = buildTokenIcsUrl(registration.confirmation_token);

    const icsContent = generateIcs({
      uid: registration.id,
      summary: event.title,
      location,
      startAt: event.starts_at,
      endAt: event.ends_at,
      organizerName: event.organizer_name || undefined,
      organizerEmail: event.organizer_email || undefined,
      attendeeName: registration.registrant_name,
      attendeeEmail: registration.registrant_email,
    });

    const bodyHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${headline}</h2>
        <p>${escapeHtml(intro)} <strong>${escapeHtml(event.title)}</strong>.</p>
        <table style="margin: 16px 0; border-collapse: collapse;">
          <tr><td style="padding: 4px 16px 4px 0; color: #666;">When</td><td>${escapeHtml(formatDateTime(event.starts_at, event.timezone))}</td></tr>
          <tr><td style="padding: 4px 16px 4px 0; color: #666;">Where</td><td>${escapeHtml(location)}</td></tr>
        </table>
        <p style="margin: 24px 0;">
          <a href="${googleCalendarUrl}" style="background-color: #2563eb; color: white; padding: 12px 20px; text-decoration: none; border-radius: 6px; display: inline-block; margin-right: 12px;">
            Add to Google Calendar
          </a>
          ${icsUrl ? `<a href="${icsUrl}" style="color: #2563eb;">Download .ics</a>` : ''}
        </p>
      </div>
    `;

    const { sendEmail } = await import('@/lib/gmail/service');
    await sendEmail(
      gmailInfo.gmailConnection,
      {
        to: registration.registrant_email,
        subject: `${isPendingWaiver ? 'Action Required' : 'Confirmed'}: ${event.title}`,
        body_html: bodyHtml,
        body_text: `${intro}\n\nEvent: ${event.title}\nWhen: ${formatDateTime(event.starts_at, event.timezone)}\nWhere: ${location}\nGoogle Calendar: ${googleCalendarUrl}${icsUrl ? `\nICS Download: ${icsUrl}` : ''}`,
        attachments: [buildIcsAttachment(icsContent)],
      },
      gmailInfo.userId,
      event.project_id
    );
  } catch (err) {
    console.error('sendWaitlistPromotionNotification error:', err);
  }
}

// ============================================================
// Event reminders (called from cron)
// ============================================================

/**
 * Send reminders for upcoming events. Called from the booking-reminders cron.
 */
export async function sendEventReminders(): Promise<void> {
  const supabase = createServiceClient();

  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in1h = new Date(now.getTime() + 60 * 60 * 1000);

    // 24h reminders
    const { data: due24h, error: due24hError } = await supabase
      .from('event_registrations')
      .select('id, registrant_name, registrant_email, confirmation_token, events!inner(title, description, starts_at, ends_at, timezone, project_id, venue_name, venue_address, virtual_url, location_type)')
      .eq('status', 'confirmed')
      .or('reminder_sent_24h.eq.false,reminder_sent_24h.is.null')
      .lte('events.starts_at', in24h.toISOString())
      .gt('events.starts_at', now.toISOString());

    if (due24hError) {
      console.error('Failed to fetch 24h reminders:', due24hError.message);
    }

    if (due24h) {
      for (const reg of due24h) {
        if (!reg.events) continue;
        const event = reg.events as unknown as {
          title: string;
          description: string | null;
          starts_at: string;
          ends_at: string;
          timezone: string;
          project_id: string;
          venue_name: string | null;
          venue_address: string | null;
          virtual_url: string | null;
          location_type: string;
        };
        const gmailInfo = await getProjectGmailConnection(event.project_id);
        if (!gmailInfo) continue;
        const location = event.location_type === 'virtual'
          ? event.virtual_url || 'Virtual'
          : [event.venue_name, event.venue_address].filter(Boolean).join(', ') || 'TBD';
        const googleCalendarUrl = buildGoogleCalendarUrl({
          title: event.title,
          startsAt: event.starts_at,
          endsAt: event.ends_at,
          description: event.description,
          location,
        });
        const icsUrl = buildTokenIcsUrl(reg.confirmation_token);

        try {
          const { sendEmail } = await import('@/lib/gmail/service');
          await sendEmail(
            gmailInfo.gmailConnection,
            {
              to: reg.registrant_email,
              subject: `Reminder: ${event.title} tomorrow`,
              body_html: `<p>Reminder: <strong>${escapeHtml(event.title)}</strong> is tomorrow at ${escapeHtml(formatDateTime(event.starts_at, event.timezone))}.</p><p><a href="${googleCalendarUrl}">Add to Google Calendar</a>${icsUrl ? ` | <a href="${icsUrl}">Download .ics</a>` : ''}</p>`,
              body_text: `Reminder: ${event.title} is tomorrow at ${formatDateTime(event.starts_at, event.timezone)}.\nGoogle Calendar: ${googleCalendarUrl}${icsUrl ? `\nICS Download: ${icsUrl}` : ''}`,
            },
            gmailInfo.userId,
            event.project_id
          );

          await supabase
            .from('event_registrations')
            .update({ reminder_sent_24h: true })
            .eq('id', reg.id);
        } catch (emailErr) {
          console.error('Failed to send 24h reminder for registration:', reg.id, emailErr);
        }
      }
    }

    // 1h reminders
    const { data: due1h, error: due1hError } = await supabase
      .from('event_registrations')
      .select('id, registrant_name, registrant_email, confirmation_token, events!inner(title, description, starts_at, ends_at, timezone, project_id, venue_name, venue_address, virtual_url, location_type)')
      .eq('status', 'confirmed')
      .or('reminder_sent_1h.eq.false,reminder_sent_1h.is.null')
      .lte('events.starts_at', in1h.toISOString())
      .gt('events.starts_at', now.toISOString());

    if (due1hError) {
      console.error('Failed to fetch 1h reminders:', due1hError.message);
    }

    if (due1h) {
      for (const reg of due1h) {
        if (!reg.events) continue;
        const event = reg.events as unknown as {
          title: string;
          description: string | null;
          starts_at: string;
          ends_at: string;
          timezone: string;
          project_id: string;
          venue_name: string | null;
          venue_address: string | null;
          virtual_url: string | null;
          location_type: string;
        };
        const gmailInfo = await getProjectGmailConnection(event.project_id);
        if (!gmailInfo) continue;
        const location = event.location_type === 'virtual'
          ? event.virtual_url || 'Virtual'
          : [event.venue_name, event.venue_address].filter(Boolean).join(', ') || 'TBD';
        const googleCalendarUrl = buildGoogleCalendarUrl({
          title: event.title,
          startsAt: event.starts_at,
          endsAt: event.ends_at,
          description: event.description,
          location,
        });
        const icsUrl = buildTokenIcsUrl(reg.confirmation_token);

        try {
          const { sendEmail } = await import('@/lib/gmail/service');
          await sendEmail(
            gmailInfo.gmailConnection,
            {
              to: reg.registrant_email,
              subject: `Starting soon: ${event.title}`,
              body_html: `<p><strong>${escapeHtml(event.title)}</strong> starts in about an hour at ${escapeHtml(formatDateTime(event.starts_at, event.timezone))}.</p><p><a href="${googleCalendarUrl}">Add to Google Calendar</a>${icsUrl ? ` | <a href="${icsUrl}">Download .ics</a>` : ''}</p>`,
              body_text: `${event.title} starts in about an hour at ${formatDateTime(event.starts_at, event.timezone)}.\nGoogle Calendar: ${googleCalendarUrl}${icsUrl ? `\nICS Download: ${icsUrl}` : ''}`,
            },
            gmailInfo.userId,
            event.project_id
          );

          await supabase
            .from('event_registrations')
            .update({ reminder_sent_1h: true })
            .eq('id', reg.id);
        } catch (emailErr) {
          console.error('Failed to send 1h reminder for registration:', reg.id, emailErr);
        }
      }
    }
  } catch (err) {
    console.error('sendEventReminders error:', err);
  }
}

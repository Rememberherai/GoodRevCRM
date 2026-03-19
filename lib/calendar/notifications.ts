/**
 * Calendar booking notifications — email confirmations, cancellations, and reminders.
 *
 * Uses the existing Gmail service for email delivery and Telnyx for SMS.
 * All functions are fire-and-forget safe (errors logged, never thrown to caller).
 */

import { createServiceClient } from '@/lib/supabase/server';
import { generateIcs } from './ics';
import type { GmailConnection } from '@/types/gmail';

// ============================================================
// Email helpers
// ============================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateTime(isoDate: string, timezone?: string | null): string {
  const tz = timezone || 'America/New_York';
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

function formatTime(isoDate: string, timezone?: string | null): string {
  const tz = timezone || 'America/New_York';
  return new Date(isoDate).toLocaleString('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function buildIcsAttachment(icsContent: string) {
  return {
    filename: 'invite.ics',
    mimeType: 'text/calendar; charset=utf-8',
    content: Buffer.from(icsContent, 'utf-8').toString('base64'),
  };
}

// ============================================================
// Load booking with event type for notifications
// ============================================================

async function loadBookingForNotification(bookingId: string) {
  const supabase = createServiceClient();

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, event_types(*)')
    .eq('id', bookingId)
    .single();

  if (!booking) return null;

  // Load host profile
  const { data: profile } = await supabase
    .from('calendar_profiles')
    .select('display_name, timezone')
    .eq('user_id', booking.host_user_id)
    .single();

  // Load host user for email
  const { data: hostUser } = await supabase
    .from('users')
    .select('email, full_name')
    .eq('id', booking.host_user_id)
    .single();

  // Load host Gmail connection for sending
  const { data: gmailConnection } = await supabase
    .from('gmail_connections')
    .select('*')
    .eq('user_id', booking.host_user_id)
    .limit(1)
    .maybeSingle();

  return {
    booking,
    eventType: booking.event_types,
    hostProfile: profile,
    hostUser,
    gmailConnection: gmailConnection as unknown as GmailConnection | null,
  };
}

// ============================================================
// Booking confirmation
// ============================================================

export async function sendBookingConfirmation(bookingId: string): Promise<void> {
  try {
    const data = await loadBookingForNotification(bookingId);
    if (!data) return;

    const { booking, eventType, hostProfile, hostUser, gmailConnection } = data;
    if (!gmailConnection || !hostUser) return;

    const hostName = hostProfile?.display_name || hostUser.full_name || 'Your host';
    const hostTz = hostProfile?.timezone || 'America/New_York';
    const inviteeTz = booking.invitee_timezone || hostTz;

    // Generate .ics attachment content
    const icsContent = generateIcs({
      uid: booking.id,
      summary: `${eventType?.title || 'Meeting'} with ${hostName}`,
      description: eventType?.description || undefined,
      location: booking.location || booking.meeting_url || undefined,
      startAt: booking.start_at,
      endAt: booking.end_at,
      organizerName: hostName,
      organizerEmail: hostUser.email,
      attendeeName: booking.invitee_name,
      attendeeEmail: booking.invitee_email,
      url: booking.meeting_url || undefined,
    });

    const dateTimeStr = formatDateTime(booking.start_at, inviteeTz);
    const status = booking.status === 'pending' ? 'Pending Confirmation' : 'Confirmed';

    // Build confirmation email HTML
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Booking ${status}</h2>
        <p>Hi ${escapeHtml(booking.invitee_name)},</p>
        <p>Your meeting has been ${status.toLowerCase()}.</p>
        <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1a1a1a;">${escapeHtml(eventType?.title || 'Meeting')}</h3>
          <p style="margin: 8px 0;"><strong>When:</strong> ${dateTimeStr}</p>
          <p style="margin: 8px 0;"><strong>Duration:</strong> ${eventType?.duration_minutes || 30} minutes</p>
          <p style="margin: 8px 0;"><strong>Host:</strong> ${escapeHtml(hostName)}</p>
          ${booking.location ? `<p style="margin: 8px 0;"><strong>Location:</strong> ${escapeHtml(booking.location)}</p>` : ''}
          ${booking.meeting_url ? `<p style="margin: 8px 0;"><strong>Meeting URL:</strong> <a href="${escapeHtml(booking.meeting_url)}">${escapeHtml(booking.meeting_url)}</a></p>` : ''}
        </div>
        ${eventType?.confirmation_message ? `<p style="color: #666;">${escapeHtml(eventType.confirmation_message)}</p>` : ''}
        <p style="color: #666; font-size: 14px;">
          Need to make changes? Use the links in this email to cancel or reschedule.
        </p>
      </div>
    `;

    // Send via Gmail service
    const { sendEmail } = await import('@/lib/gmail/service');
    await sendEmail(
      gmailConnection,
      {
        to: booking.invitee_email,
        subject: `${status}: ${eventType?.title || 'Meeting'} - ${formatTime(booking.start_at, inviteeTz)}`,
        body_html: html,
        attachments: [buildIcsAttachment(icsContent)],
      },
      booking.host_user_id,
      booking.project_id,
      hostName
    );

    // Also create an in-app notification for the host
    const supabase = createServiceClient();
    await supabase.from('notifications').insert({
      user_id: booking.host_user_id,
      project_id: booking.project_id,
      type: 'meeting_scheduled',
      title: 'New Booking',
      message: `${booking.invitee_name} booked ${eventType?.title || 'a meeting'} for ${formatDateTime(booking.start_at, hostTz)}`,
      entity_type: 'booking',
      entity_id: booking.id,
      action_url: `/calendar/bookings/${booking.id}`,
    });
  } catch (err) {
    console.error('Error sending booking confirmation:', err);
  }
}

// ============================================================
// Booking cancellation
// ============================================================

export async function sendBookingCancellation(bookingId: string): Promise<void> {
  try {
    const data = await loadBookingForNotification(bookingId);
    if (!data) return;

    const { booking, eventType, hostProfile, hostUser, gmailConnection } = data;
    if (!gmailConnection || !hostUser) return;

    const hostName = hostProfile?.display_name || hostUser.full_name || 'Your host';
    const inviteeTz = booking.invitee_timezone || hostProfile?.timezone || 'America/New_York';
    const hostTz = hostProfile?.timezone || 'America/New_York';
    const cancelledByLabel = booking.cancelled_by === 'host' ? hostName : booking.invitee_name;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Booking Cancelled</h2>
        <p>Hi ${escapeHtml(booking.invitee_name)},</p>
        <p>The following booking has been cancelled by ${escapeHtml(cancelledByLabel)}.</p>
        <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1a1a1a;">${escapeHtml(eventType?.title || 'Meeting')}</h3>
          <p style="margin: 8px 0;"><strong>Was scheduled for:</strong> ${formatDateTime(booking.start_at, inviteeTz)}</p>
          ${booking.cancellation_reason ? `<p style="margin: 8px 0;"><strong>Reason:</strong> ${escapeHtml(booking.cancellation_reason)}</p>` : ''}
        </div>
      </div>
    `;

    const { sendEmail } = await import('@/lib/gmail/service');
    await sendEmail(
      gmailConnection,
      {
        to: booking.invitee_email,
        subject: `Cancelled: ${eventType?.title || 'Meeting'} - ${formatTime(booking.start_at, inviteeTz)}`,
        body_html: html,
      },
      booking.host_user_id,
      booking.project_id,
      hostName
    );

    // Notify host if cancelled by invitee
    if (booking.cancelled_by === 'invitee') {
      const supabase = createServiceClient();
      await supabase.from('notifications').insert({
        user_id: booking.host_user_id,
        project_id: booking.project_id,
        type: 'system',
        title: 'Booking Cancelled',
        message: `${booking.invitee_name} cancelled their ${eventType?.title || 'booking'} for ${formatDateTime(booking.start_at, hostTz)}`,
        entity_type: 'booking',
        entity_id: booking.id,
        action_url: `/calendar/bookings/${booking.id}`,
      });
    }
  } catch (err) {
    console.error('Error sending booking cancellation:', err);
  }
}

// ============================================================
// Booking reminders (called from cron)
// ============================================================

export async function sendBookingReminders(): Promise<{ sent24h: number; sent1h: number }> {
  const supabase = createServiceClient();
  const now = new Date();
  let sent24h = 0;
  let sent1h = 0;

  // 24h reminders: bookings starting between 23h-25h from now
  const window24hStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const window24hEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const { data: reminders24h } = await supabase
    .from('bookings')
    .select('id')
    .in('status', ['confirmed'])
    .eq('reminder_sent_24h', false)
    .gte('start_at', window24hStart.toISOString())
    .lte('start_at', window24hEnd.toISOString())
    .limit(100);

  if (reminders24h) {
    for (const booking of reminders24h) {
      try {
        await sendReminderEmail(booking.id, '24h');
        await supabase
          .from('bookings')
          .update({ reminder_sent_24h: true })
          .eq('id', booking.id);
        sent24h++;
      } catch (err) {
        console.error(`Failed 24h reminder for booking ${booking.id}:`, err);
      }
    }
  }

  // 1h reminders: bookings starting between 30m-90m from now
  const window1hStart = new Date(now.getTime() + 30 * 60 * 1000);
  const window1hEnd = new Date(now.getTime() + 90 * 60 * 1000);

  const { data: reminders1h } = await supabase
    .from('bookings')
    .select('id')
    .in('status', ['confirmed'])
    .eq('reminder_sent_1h', false)
    .gte('start_at', window1hStart.toISOString())
    .lte('start_at', window1hEnd.toISOString())
    .limit(100);

  if (reminders1h) {
    for (const booking of reminders1h) {
      try {
        await sendReminderEmail(booking.id, '1h');
        await supabase
          .from('bookings')
          .update({ reminder_sent_1h: true })
          .eq('id', booking.id);
        sent1h++;
      } catch (err) {
        console.error(`Failed 1h reminder for booking ${booking.id}:`, err);
      }
    }
  }

  return { sent24h, sent1h };
}

async function sendReminderEmail(bookingId: string, type: '24h' | '1h'): Promise<void> {
  const data = await loadBookingForNotification(bookingId);
  if (!data) return;

  const { booking, eventType, hostProfile, hostUser, gmailConnection } = data;
  if (!gmailConnection || !hostUser) return;

  const hostName = hostProfile?.display_name || hostUser.full_name || 'Your host';
  const inviteeTz = booking.invitee_timezone || hostProfile?.timezone || 'America/New_York';
  const timeLabel = type === '24h' ? 'tomorrow' : 'in 1 hour';
  const icsContent = generateIcs({
    uid: booking.id,
    summary: `${eventType?.title || 'Meeting'} with ${hostName}`,
    description: eventType?.description || undefined,
    location: booking.location || booking.meeting_url || undefined,
    startAt: booking.start_at,
    endAt: booking.end_at,
    organizerName: hostName,
    organizerEmail: hostUser.email,
    attendeeName: booking.invitee_name,
    attendeeEmail: booking.invitee_email,
    url: booking.meeting_url || undefined,
  });

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">Reminder: Your meeting is ${timeLabel}</h2>
      <p>Hi ${escapeHtml(booking.invitee_name)},</p>
      <p>This is a reminder about your upcoming meeting.</p>
      <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #1a1a1a;">${escapeHtml(eventType?.title || 'Meeting')}</h3>
        <p style="margin: 8px 0;"><strong>When:</strong> ${formatDateTime(booking.start_at, inviteeTz)}</p>
        <p style="margin: 8px 0;"><strong>Duration:</strong> ${eventType?.duration_minutes || 30} minutes</p>
        <p style="margin: 8px 0;"><strong>Host:</strong> ${escapeHtml(hostName)}</p>
        ${booking.meeting_url ? `<p style="margin: 8px 0;"><strong>Join:</strong> <a href="${escapeHtml(booking.meeting_url)}">${escapeHtml(booking.meeting_url)}</a></p>` : ''}
      </div>
    </div>
  `;

  const { sendEmail } = await import('@/lib/gmail/service');
  await sendEmail(
    gmailConnection,
    {
      to: booking.invitee_email,
      subject: `Reminder: ${eventType?.title || 'Meeting'} ${timeLabel} - ${formatTime(booking.start_at, inviteeTz)}`,
      body_html: html,
      attachments: [buildIcsAttachment(icsContent)],
    },
    booking.host_user_id,
    booking.project_id,
    hostName
  );
}

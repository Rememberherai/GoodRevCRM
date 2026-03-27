/**
 * Asset access notifications — email notifications for the public verification flow.
 *
 * Guest emails: verification, confirmed, queued, denied, cancelled
 * Approver emails: new request notification
 *
 * All functions are fire-and-forget safe (errors logged, never thrown to caller).
 * Uses the project's Gmail connection (owner/admin) for sending.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getProjectGmailConnection } from '@/lib/events/notifications';

// ── Helpers ────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateTime(isoDate: string, timezone?: string): string {
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

// ── Verification email ─────────────────────────────────────────

export async function sendVerificationEmail(opts: {
  verificationId: string;
  token: string;
  projectId: string;
  assetName: string;
  guestName: string;
  guestEmail: string;
  requestedStartAt: string;
  requestedEndAt: string;
  expiresAt: string;
}): Promise<void> {
  try {
    const conn = await getProjectGmailConnection(opts.projectId);
    if (!conn) return;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const verifyUrl = `${baseUrl}/resources/verify/${opts.token}`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Verify Your Request</h2>
        <p>Hi ${escapeHtml(opts.guestName)},</p>
        <p>Please confirm your request for <strong>${escapeHtml(opts.assetName)}</strong>.</p>
        <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 8px 0;"><strong>Resource:</strong> ${escapeHtml(opts.assetName)}</p>
          <p style="margin: 8px 0;"><strong>When:</strong> ${formatDateTime(opts.requestedStartAt)}</p>
        </div>
        <p>
          <a href="${escapeHtml(verifyUrl)}"
             style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
            Confirm Request
          </a>
        </p>
        <p style="color: #666; font-size: 14px; margin-top: 20px;">
          This link expires in 30 minutes. If you did not request this, you can safely ignore this email.
        </p>
      </div>
    `;

    const { sendEmail } = await import('@/lib/gmail/service');
    await sendEmail(
      conn.gmailConnection,
      {
        to: opts.guestEmail,
        subject: `Verify your request for ${opts.assetName}`,
        body_html: html,
      },
      conn.userId,
      opts.projectId
    );
  } catch (err) {
    console.error('Error sending verification email:', err);
  }
}

// ── Confirmed email ────────────────────────────────────────────

export async function sendConfirmedEmail(
  bookingId: string,
  projectId: string
): Promise<void> {
  try {
    const supabase = createServiceClient();
    const conn = await getProjectGmailConnection(projectId);
    if (!conn) return;

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, start_at, end_at, invitee_name, invitee_email, invitee_timezone, cancel_token, reschedule_token, ics_token, event_types(title, asset_id)')
      .eq('id', bookingId)
      .single();

    if (!booking) return;

    const eventType = booking.event_types as unknown as { title: string; asset_id: string } | null;
    let assetName = eventType?.title || 'Resource';

    if (eventType?.asset_id) {
      const { data: asset } = await supabase
        .from('community_assets')
        .select('public_name, name')
        .eq('id', eventType.asset_id)
        .single();
      if (asset) assetName = asset.public_name || asset.name;
    }

    const tz = booking.invitee_timezone || 'America/New_York';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const cancelUrl = booking.cancel_token ? `${baseUrl}/book/cancel/${booking.cancel_token}` : null;
    const rescheduleUrl = booking.reschedule_token ? `${baseUrl}/book/reschedule/${booking.reschedule_token}` : null;
    const icsUrl = booking.ics_token ? `${baseUrl}/api/book/ics?token=${booking.ics_token}` : null;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Request Confirmed</h2>
        <p>Hi ${escapeHtml(booking.invitee_name)},</p>
        <p>Your request for <strong>${escapeHtml(assetName)}</strong> has been confirmed.</p>
        <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 8px 0;"><strong>Resource:</strong> ${escapeHtml(assetName)}</p>
          <p style="margin: 8px 0;"><strong>When:</strong> ${formatDateTime(booking.start_at, tz)}</p>
        </div>
        ${cancelUrl || rescheduleUrl || icsUrl ? `
        <p style="color: #666; font-size: 14px;">
          ${icsUrl ? `<a href="${escapeHtml(icsUrl)}" style="color: #16a34a;">Add to calendar</a>` : ''}
          ${icsUrl && (rescheduleUrl || cancelUrl) ? ' | ' : ''}
          ${rescheduleUrl ? `<a href="${escapeHtml(rescheduleUrl)}" style="color: #3b82f6;">Reschedule</a>` : ''}
          ${rescheduleUrl && cancelUrl ? ' | ' : ''}
          ${cancelUrl ? `<a href="${escapeHtml(cancelUrl)}" style="color: #dc2626;">Cancel</a>` : ''}
        </p>` : ''}
      </div>
    `;

    const { sendEmail } = await import('@/lib/gmail/service');
    await sendEmail(
      conn.gmailConnection,
      {
        to: booking.invitee_email,
        subject: `Confirmed: ${assetName} - ${formatDateTime(booking.start_at, tz)}`,
        body_html: html,
      },
      conn.userId,
      projectId
    );
  } catch (err) {
    console.error('Error sending confirmed email:', err);
  }
}

// ── Queued (pending review) email ──────────────────────────────

export async function sendQueuedEmail(opts: {
  guestName: string;
  guestEmail: string;
  assetName: string;
  projectId: string;
}): Promise<void> {
  try {
    const conn = await getProjectGmailConnection(opts.projectId);
    if (!conn) return;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Request Received</h2>
        <p>Hi ${escapeHtml(opts.guestName)},</p>
        <p>Your request for <strong>${escapeHtml(opts.assetName)}</strong> has been received and is being reviewed.</p>
        <p style="color: #666;">You'll receive an email once your request has been approved or if any changes are needed.</p>
      </div>
    `;

    const { sendEmail } = await import('@/lib/gmail/service');
    await sendEmail(
      conn.gmailConnection,
      {
        to: opts.guestEmail,
        subject: `Request received: ${opts.assetName}`,
        body_html: html,
      },
      conn.userId,
      opts.projectId
    );
  } catch (err) {
    console.error('Error sending queued email:', err);
  }
}

// ── Denied email ───────────────────────────────────────────────

export async function sendDeniedEmail(
  bookingId: string,
  projectId: string
): Promise<void> {
  try {
    const supabase = createServiceClient();
    const conn = await getProjectGmailConnection(projectId);
    if (!conn) return;

    const { data: booking } = await supabase
      .from('bookings')
      .select('invitee_name, invitee_email, event_types(title, asset_id)')
      .eq('id', bookingId)
      .single();

    if (!booking) return;

    const eventType = booking.event_types as unknown as { title: string; asset_id: string } | null;
    let assetName = eventType?.title || 'Resource';

    if (eventType?.asset_id) {
      const { data: asset } = await supabase
        .from('community_assets')
        .select('public_name, name')
        .eq('id', eventType.asset_id)
        .single();
      if (asset) assetName = asset.public_name || asset.name;
    }

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Request Update</h2>
        <p>Hi ${escapeHtml(booking.invitee_name)},</p>
        <p>Unfortunately, your request for <strong>${escapeHtml(assetName)}</strong> could not be approved at this time.</p>
        <p style="color: #666;">If you have questions, please contact the organization directly.</p>
      </div>
    `;

    const { sendEmail } = await import('@/lib/gmail/service');
    await sendEmail(
      conn.gmailConnection,
      {
        to: booking.invitee_email,
        subject: `Update on your request for ${assetName}`,
        body_html: html,
      },
      conn.userId,
      projectId
    );
  } catch (err) {
    console.error('Error sending denied email:', err);
  }
}

// ── Cancelled email ────────────────────────────────────────────

export async function sendCancelledEmail(
  bookingId: string,
  projectId: string
): Promise<void> {
  try {
    const supabase = createServiceClient();
    const conn = await getProjectGmailConnection(projectId);
    if (!conn) return;

    const { data: booking } = await supabase
      .from('bookings')
      .select('invitee_name, invitee_email, start_at, invitee_timezone, event_types(title, asset_id)')
      .eq('id', bookingId)
      .single();

    if (!booking) return;

    const eventType = booking.event_types as unknown as { title: string; asset_id: string } | null;
    let assetName = eventType?.title || 'Resource';

    if (eventType?.asset_id) {
      const { data: asset } = await supabase
        .from('community_assets')
        .select('public_name, name')
        .eq('id', eventType.asset_id)
        .single();
      if (asset) assetName = asset.public_name || asset.name;
    }

    const tz = booking.invitee_timezone || 'America/New_York';

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Reservation Cancelled</h2>
        <p>Hi ${escapeHtml(booking.invitee_name)},</p>
        <p>Your reservation for <strong>${escapeHtml(assetName)}</strong> on ${formatDateTime(booking.start_at, tz)} has been cancelled.</p>
        <p style="color: #666;">If you have questions, please contact the organization directly.</p>
      </div>
    `;

    const { sendEmail } = await import('@/lib/gmail/service');
    await sendEmail(
      conn.gmailConnection,
      {
        to: booking.invitee_email,
        subject: `Cancelled: ${assetName} - ${formatDateTime(booking.start_at, tz)}`,
        body_html: html,
      },
      conn.userId,
      projectId
    );
  } catch (err) {
    console.error('Error sending cancelled email:', err);
  }
}

// ── New request notification (to approvers) ────────────────────

export async function sendNewRequestNotification(opts: {
  bookingId: string;
  assetId: string;
  projectId: string;
  assetName: string;
  guestName: string;
  requestedStartAt: string;
}): Promise<void> {
  try {
    const supabase = createServiceClient();
    const conn = await getProjectGmailConnection(opts.projectId);
    if (!conn) return;

    // Determine who to notify: assigned approvers, or all owner/admin
    const { data: approvers } = await supabase
      .from('community_asset_approvers')
      .select('user_id')
      .eq('asset_id', opts.assetId);

    let notifyUserIds: string[];

    if (approvers && approvers.length > 0) {
      notifyUserIds = approvers.map((a) => a.user_id);
    } else {
      // Fallback: notify all owners and admins
      const { data: members } = await supabase
        .from('project_memberships')
        .select('user_id')
        .eq('project_id', opts.projectId)
        .in('role', ['owner', 'admin']);
      notifyUserIds = (members ?? []).map((m) => m.user_id);
    }

    if (notifyUserIds.length === 0) return;

    // Load user emails
    const { data: users } = await supabase
      .from('users')
      .select('id, email, full_name')
      .in('id', notifyUserIds);

    if (!users || users.length === 0) return;

    // Find project slug for link
    const { data: project } = await supabase
      .from('projects')
      .select('slug')
      .eq('id', opts.projectId)
      .single();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const reviewUrl = project ? `${baseUrl}/projects/${project.slug}/community-assets` : baseUrl;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">New Access Request</h2>
        <p>A new request needs your review.</p>
        <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 8px 0;"><strong>Resource:</strong> ${escapeHtml(opts.assetName)}</p>
          <p style="margin: 8px 0;"><strong>Requested by:</strong> ${escapeHtml(opts.guestName)}</p>
          <p style="margin: 8px 0;"><strong>When:</strong> ${formatDateTime(opts.requestedStartAt)}</p>
        </div>
        <p>
          <a href="${escapeHtml(reviewUrl)}"
             style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
            Review Request
          </a>
        </p>
      </div>
    `;

    // Send to each approver and create in-app notifications
    const { sendEmail } = await import('@/lib/gmail/service');
    for (const user of users) {
      sendEmail(
        conn.gmailConnection,
        {
          to: user.email,
          subject: `New access request: ${opts.assetName} from ${opts.guestName}`,
          body_html: html,
        },
        conn.userId,
        opts.projectId
      ).catch((e) => console.error(`Failed to send approver email to ${user.email}:`, e));

      // In-app notification
      supabase.from('notifications').insert({
        user_id: user.id,
        project_id: opts.projectId,
        type: 'system',
        title: 'New Access Request',
        message: `${opts.guestName} requested access to ${opts.assetName}`,
        data: { subtype: 'asset_access_request', booking_id: opts.bookingId, asset_id: opts.assetId },
        entity_type: 'booking',
        entity_id: opts.bookingId,
        action_url: reviewUrl.replace(baseUrl, ''),
      }).then(() => {}, (e: unknown) => console.error('Failed to create notification:', e));
    }
  } catch (err) {
    console.error('Error sending new request notification:', err);
  }
}

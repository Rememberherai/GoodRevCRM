import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/gmail/service';
import { insertAuditTrail } from './audit';
import type { GmailConnection } from '@/types/gmail';

type NotifyEvent = 'viewed' | 'signed' | 'declined';

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Fire-and-forget owner notification when a signer views, signs, or declines.
 * Failures are logged but never block the signer flow.
 */
export async function notifyOwner(
  documentId: string,
  event: NotifyEvent,
  details: { recipientName: string; reason?: string }
): Promise<void> {
  try {
    const supabase = createServiceClient();

    const { data: document } = await supabase
      .from('contract_documents')
      .select('title, gmail_connection_id, owner_id, project_id, notify_on_view, notify_on_sign, notify_on_decline')
      .eq('id', documentId)
      .single();

    if (!document?.gmail_connection_id || !document.owner_id) return;

    // Check notification preference
    if (event === 'viewed' && !document.notify_on_view) return;
    if (event === 'signed' && !document.notify_on_sign) return;
    if (event === 'declined' && !document.notify_on_decline) return;

    // Get owner email
    const { data: owner } = await supabase
      .from('users')
      .select('email')
      .eq('id', document.owner_id)
      .single();

    if (!owner?.email) return;

    // Get Gmail connection
    const { data: connection } = await supabase
      .from('gmail_connections')
      .select('*')
      .eq('id', document.gmail_connection_id)
      .single();

    if (!connection || (connection as unknown as GmailConnection).status !== 'connected') {
      insertAuditTrail({
        project_id: document.project_id,
        document_id: documentId,
        action: 'send_failed',
        actor_type: 'system',
        details: { type: 'owner_notification', event, reason: 'gmail_connection_expired' },
      });
      return;
    }

    const subjects: Record<NotifyEvent, string> = {
      viewed: `${details.recipientName} viewed "${document.title}"`,
      signed: `${details.recipientName} signed "${document.title}"`,
      declined: `${details.recipientName} declined "${document.title}"`,
    };

    const bodies: Record<NotifyEvent, string> = {
      viewed: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <p><strong>${escHtml(details.recipientName)}</strong> has opened and is viewing <strong>${escHtml(document.title)}</strong>.</p>
          <p style="color: #6b7280; font-size: 14px;">This is an automated notification from your CRM.</p>
        </div>
      `,
      signed: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <p><strong>${escHtml(details.recipientName)}</strong> has signed <strong>${escHtml(document.title)}</strong>.</p>
          <p style="color: #6b7280; font-size: 14px;">You can view the signing status from your CRM dashboard.</p>
        </div>
      `,
      declined: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <p><strong>${escHtml(details.recipientName)}</strong> has declined to sign <strong>${escHtml(document.title)}</strong>.</p>
          ${details.reason ? `<p style="margin: 12px 0; padding: 12px; border-left: 3px solid #ef4444; color: #374151;"><strong>Reason:</strong> ${escHtml(details.reason)}</p>` : ''}
          <p style="color: #6b7280; font-size: 14px;">You can view details from your CRM dashboard.</p>
        </div>
      `,
    };

    await sendEmail(
      connection as unknown as GmailConnection,
      {
        to: owner.email,
        subject: subjects[event],
        body_html: bodies[event],
      },
      (connection as unknown as GmailConnection).user_id,
      document.project_id
    );
  } catch (err) {
    console.error(`[NOTIFY] Owner notification failed for ${documentId} (${event}):`, err);
  }
}

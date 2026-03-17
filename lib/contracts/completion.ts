import { createServiceClient } from '@/lib/supabase/server';
import { flattenPdf } from './pdf-flatten';
import { generateCertificate } from './certificate';
import { insertAuditTrail } from './audit';
import { sendEmail } from '@/lib/gmail/service';
import type { GmailConnection } from '@/types/gmail';

/**
 * Phase B completion handler — called after CAS wins completion.
 * Idempotent: skips artifacts that already exist.
 * Also used by the completion repair cron.
 */
export async function handleCompletion(documentId: string, projectId: string): Promise<void> {
  const supabase = createServiceClient();

  const { data: document } = await supabase
    .from('contract_documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (!document) return;

  // 1. Flatten PDF (skip if already done)
  if (!document.signed_file_path) {
    try {
      const { pdfBytes, hash } = await flattenPdf({ documentId, projectId });
      const signedPath = `${projectId}/documents/${documentId}/signed_${document.original_file_name}`;

      const { error: uploadError } = await supabase.storage.from('contracts').upload(signedPath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('contract_documents')
        .update({ signed_file_path: signedPath, signed_file_hash: hash })
        .eq('id', documentId);
      if (updateError) throw updateError;

      console.log(`[COMPLETION] Flattened PDF for ${documentId}`);
    } catch (err) {
      console.error(`[COMPLETION] Flatten failed for ${documentId}:`, err);
      return; // Stop — retry via cron
    }
  }

  // 2. Generate certificate (skip if already done)
  if (!document.certificate_file_path) {
    try {
      const certBytes = await generateCertificate({ documentId, projectId });
      const certPath = `${projectId}/documents/${documentId}/certificate.pdf`;

      const { error: uploadError } = await supabase.storage.from('contracts').upload(certPath, certBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('contract_documents')
        .update({ certificate_file_path: certPath })
        .eq('id', documentId);
      if (updateError) throw updateError;

      console.log(`[COMPLETION] Certificate generated for ${documentId}`);
    } catch (err) {
      console.error(`[COMPLETION] Certificate failed for ${documentId}:`, err);
      return; // Stop — retry via cron
    }
  }

  // 3. Send receipt emails (CAS-reserve receipt_sent_at first)
  const shouldSendReceipts = document.send_completed_copy_to_sender !== false || document.send_completed_copy_to_recipients !== false;
  if (!document.receipt_sent_at && !shouldSendReceipts) {
    // No receipts needed — mark as sent to prevent cron retry
    await supabase
      .from('contract_documents')
      .update({ receipt_sent_at: new Date().toISOString() })
      .eq('id', documentId)
      .is('receipt_sent_at', null);
    console.log(`[COMPLETION] Receipts disabled for ${documentId}, marking as sent`);
    return;
  }
  if (!document.receipt_sent_at && shouldSendReceipts) {
    // CAS: reserve
    const { data: reserved } = await supabase
      .from('contract_documents')
      .update({ receipt_sent_at: new Date().toISOString() })
      .eq('id', documentId)
      .is('receipt_sent_at', null)
      .select('id')
      .single();

    if (!reserved) {
      console.log(`[COMPLETION] Receipts already sent for ${documentId}`);
      return;
    }

    try {
      await sendReceiptEmails(documentId, projectId, supabase, {
        toSender: document.send_completed_copy_to_sender !== false,
        toRecipients: document.send_completed_copy_to_recipients !== false,
      });
      console.log(`[COMPLETION] Receipts sent for ${documentId}`);
    } catch (err) {
      console.error(`[COMPLETION] Receipt emails failed for ${documentId}:`, err);
      // NULL back receipt_sent_at so cron can retry
      await supabase
        .from('contract_documents')
        .update({ receipt_sent_at: null })
        .eq('id', documentId);
    }
  }
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendReceiptEmails(
  documentId: string,
  projectId: string,
  supabase: ReturnType<typeof createServiceClient>,
  options: { toSender: boolean; toRecipients: boolean } = { toSender: true, toRecipients: true }
) {
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    console.error('[COMPLETION] NEXT_PUBLIC_APP_URL is not set, skipping receipt emails');
    return;
  }

  const { data: document } = await supabase
    .from('contract_documents')
    .select('title, gmail_connection_id, sender_email, owner_id')
    .eq('id', documentId)
    .single();

  if (!document?.gmail_connection_id) return;

  const { data: connection } = await (supabase as unknown as { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: string) => { single: () => Promise<{ data: GmailConnection | null }> } } } })
    .from('gmail_connections')
    .select('*')
    .eq('id', document.gmail_connection_id)
    .single();

  if (!connection || (connection as GmailConnection).status !== 'connected') {
    insertAuditTrail({
      project_id: projectId,
      document_id: documentId,
      action: 'send_failed',
      actor_type: 'system',
      details: { skipped: true, reason: 'gmail_connection_expired', type: 'receipt' },
    });
    return;
  }

  // Send to recipients if enabled
  if (options.toRecipients) {
    const { data: recipients } = await supabase
      .from('contract_recipients')
      .select('id, name, email, role, signing_token')
      .eq('document_id', documentId);

    for (const recipient of recipients ?? []) {
      try {
        const downloadUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/sign/${recipient.signing_token}/download`;
        await sendEmail(
          connection as GmailConnection,
          {
            to: recipient.email,
            subject: `Completed: ${document.title}`,
            body_html: `
              <div style="font-family: sans-serif; max-width: 600px;">
                <h2>Document Completed</h2>
                <p>Hi ${escHtml(recipient.name)},</p>
                <p>All parties have signed <strong>${escHtml(document.title)}</strong>. The document is now complete.</p>
                <p style="margin: 24px 0;">
                  <a href="${downloadUrl}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Download Signed Document
                  </a>
                </p>
                <p style="color: #6b7280; font-size: 14px;">
                  You can download your copy at any time using the link above.
                </p>
              </div>
            `,
          },
          (connection as GmailConnection).user_id,
          projectId
        );
      } catch (err) {
        console.error(`[COMPLETION] Receipt email to ${recipient.email} failed:`, err);
        throw err; // Propagate to trigger retry
      }
    }
  }

  // Send to sender/owner if enabled
  if (options.toSender && document.sender_email) {
    try {
      await sendEmail(
        connection as GmailConnection,
        {
          to: document.sender_email,
          subject: `Completed: ${document.title}`,
          body_html: `
            <div style="font-family: sans-serif; max-width: 600px;">
              <h2>Document Completed</h2>
              <p>All parties have signed <strong>${escHtml(document.title)}</strong>. The document is now complete.</p>
              <p>You can view and download the signed document from your CRM dashboard.</p>
            </div>
          `,
        },
        (connection as GmailConnection).user_id,
        projectId
      );
    } catch (err) {
      console.error(`[COMPLETION] Receipt email to sender ${document.sender_email} failed:`, err);
      throw err;
    }
  }
}

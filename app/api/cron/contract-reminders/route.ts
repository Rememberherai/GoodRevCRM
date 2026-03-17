import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/gmail/service';
import { insertAuditTrail } from '@/lib/contracts/audit';
import { handleCompletion } from '@/lib/contracts/completion';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { GmailConnection } from '@/types/gmail';

export const maxDuration = 60;

/**
 * Contract cron job:
 * 1. Send reminders for documents where reminder_enabled = true
 * 2. Expire documents past expires_at
 * 3. Repair incomplete completions (Phase B failures)
 */
async function processContracts() {
  const supabase = createServiceClient();
  const results = { reminders: 0, expired: 0, repaired: 0, errors: 0 };

  // --- 1. Send reminders ---
  try {
    const { data: docs } = await supabase
      .from('contract_documents')
      .select('id, project_id, title, gmail_connection_id, sender_email, owner_id, reminder_interval_days')
      .in('status', ['sent', 'viewed', 'partially_signed'])
      .eq('reminder_enabled', true)
      .is('deleted_at', null)
      .not('gmail_connection_id', 'is', null);

    for (const doc of docs ?? []) {
      try {
        // Check if enough time has passed since last reminder
        const intervalDays = doc.reminder_interval_days ?? 3;
        const { data: lastReminder } = await supabase
          .from('contract_audit_trail')
          .select('created_at')
          .eq('document_id', doc.id)
          .in('action', ['sent', 'reminder_sent'])
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (lastReminder) {
          const lastDate = new Date(lastReminder.created_at);
          const now = new Date();
          const daysSince = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSince < intervalDays) continue;
        }

        // Get pending recipients
        const { data: recipients } = await supabase
          .from('contract_recipients')
          .select('id, name, email, status, signing_token')
          .eq('document_id', doc.id)
          .in('status', ['sent', 'viewed']);

        if (!recipients?.length) continue;

        // Fetch Gmail connection
        const { data: connection } = await supabase
          .from('gmail_connections')
          .select('*')
          .eq('id', doc.gmail_connection_id!)
          .single();

        if (!connection || connection.status !== 'connected') {
          insertAuditTrail({
            project_id: doc.project_id,
            document_id: doc.id,
            action: 'reminder_sent',
            actor_type: 'system',
            details: { skipped: true, reason: 'gmail_connection_expired' },
          });
          continue;
        }

        // Send reminder to each pending recipient
        for (const recipient of recipients) {
          try {
            await sendEmail(
              connection as unknown as GmailConnection,
              {
                to: recipient.email,
                subject: `Reminder: Please sign "${doc.title}"`,
                body_html: `<p>Hi ${(recipient.name ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')},</p><p>This is a reminder that you have a document waiting for your signature: <strong>${(doc.title ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</strong>.</p><p style="margin: 24px 0;"><a href="${process.env.NEXT_PUBLIC_APP_URL}/sign/${recipient.signing_token}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Review &amp; Sign Document</a></p>`,
              },
              doc.owner_id ?? 'system',
              doc.project_id,
            );
          } catch (emailErr) {
            console.error(`[Contract Cron] Failed to send reminder to ${recipient.email}:`, emailErr);
          }
        }

        insertAuditTrail({
          project_id: doc.project_id,
          document_id: doc.id,
          action: 'reminder_sent',
          actor_type: 'system',
          details: { recipient_count: recipients.length },
        });

        // Update last_reminder_at
        await supabase
          .from('contract_documents')
          .update({ last_reminder_at: new Date().toISOString() })
          .eq('id', doc.id);

        results.reminders++;
      } catch (err) {
        console.error(`[Contract Cron] Error processing reminder for doc ${doc.id}:`, err);
        results.errors++;
      }
    }
  } catch (err) {
    console.error('[Contract Cron] Error fetching reminder docs:', err);
    results.errors++;
  }

  // --- 2. Expire documents past expires_at ---
  try {
    const { data: expiredDocs } = await supabase
      .from('contract_documents')
      .select('id, project_id, title')
      .in('status', ['sent', 'viewed', 'partially_signed'])
      .lt('expires_at', new Date().toISOString())
      .is('deleted_at', null);

    for (const doc of expiredDocs ?? []) {
      try {
        const { error } = await supabase
          .from('contract_documents')
          .update({ status: 'expired' })
          .eq('id', doc.id)
          .in('status', ['sent', 'viewed', 'partially_signed']);

        if (error) {
          console.error(`[Contract Cron] Failed to expire doc ${doc.id}:`, error.message);
          results.errors++;
          continue;
        }

        insertAuditTrail({
          project_id: doc.project_id,
          document_id: doc.id,
          action: 'expired',
          actor_type: 'system',
        });

        emitAutomationEvent({
          projectId: doc.project_id,
          triggerType: 'document.expired',
          entityType: 'document',
          entityId: doc.id,
          data: { title: doc.title },
        });

        results.expired++;
      } catch (err) {
        console.error(`[Contract Cron] Error expiring doc ${doc.id}:`, err);
        results.errors++;
      }
    }
  } catch (err) {
    console.error('[Contract Cron] Error fetching expired docs:', err);
    results.errors++;
  }

  // --- 3. Repair incomplete completions ---
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: incompleteDocs } = await supabase
      .from('contract_documents')
      .select('*')
      .eq('status', 'completed')
      .lt('completed_at', fiveMinAgo)
      .is('deleted_at', null)
      .or('signed_file_path.is.null,certificate_file_path.is.null,receipt_sent_at.is.null');

    for (const doc of incompleteDocs ?? []) {
      try {
        await handleCompletion(doc.id, doc.project_id);
        results.repaired++;
      } catch (err) {
        console.error(`[Contract Cron] Error repairing completion for doc ${doc.id}:`, err);
        results.errors++;
      }
    }
  } catch (err) {
    console.error('[Contract Cron] Error fetching incomplete completions:', err);
    results.errors++;
  }

  return results;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    try {
      const result = await processContracts();
      return NextResponse.json({ success: true, ...result });
    } catch (error) {
      console.error('[Contract Cron] Error:', error instanceof Error ? error.message : 'Unknown error');
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  }

  // Fall back to user session auth
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processContracts();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[Contract Cron] Error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}

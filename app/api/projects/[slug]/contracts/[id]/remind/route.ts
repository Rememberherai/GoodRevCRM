import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { insertAuditTrail } from '@/lib/contracts/audit';
import { sendEmail } from '@/lib/gmail/service';
import type { GmailConnection } from '@/types/gmail';

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const { slug, id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const { data: document } = await supabase
    .from('contract_documents')
    .select('*')
    .eq('id', id)
    .eq('project_id', project.id)
    .is('deleted_at', null)
    .single();

  if (!document) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  const activeStatuses = ['sent', 'viewed', 'partially_signed'];
  if (!activeStatuses.includes(document.status)) {
    return NextResponse.json({ error: `Cannot send reminders for ${document.status} contracts` }, { status: 400 });
  }

  if (!document.gmail_connection_id) {
    return NextResponse.json({ error: 'No Gmail connection stored for this contract' }, { status: 400 });
  }

  // Get the stored Gmail connection via service client
  const adminClient = createServiceClient();
  const { data: connection } = await (adminClient as unknown as { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: string) => { single: () => Promise<{ data: GmailConnection | null }> } } } })
    .from('gmail_connections')
    .select('*')
    .eq('id', document.gmail_connection_id)
    .single();

  if (!connection || (connection as GmailConnection).status !== 'connected') {
    insertAuditTrail({
      project_id: project.id,
      document_id: id,
      action: 'reminder_sent',
      actor_type: 'user',
      actor_id: user.id,
      details: { skipped: true, reason: 'gmail_connection_expired' },
    });
    return NextResponse.json({ error: 'Gmail connection is expired or deleted' }, { status: 400 });
  }

  // Get pending/sent/viewed recipients who haven't signed
  const { data: recipients } = await adminClient
    .from('contract_recipients')
    .select('*')
    .eq('document_id', id)
    .eq('project_id', project.id)
    .in('status', ['sent', 'viewed']);

  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ error: 'No recipients need reminders' }, { status: 400 });
  }

  const gmailConn = connection as GmailConnection;
  let sentCount = 0;

  for (const recipient of recipients) {
    try {
      const signingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/sign/${recipient.signing_token}`;
      await sendEmail(
        gmailConn,
        {
          to: recipient.email,
          subject: `Reminder: Please sign ${document.title}`,
          body_html: `
            <div style="font-family: sans-serif; max-width: 600px;">
              <h2>Signature Reminder</h2>
              <p>Hi ${escHtml(recipient.name)},</p>
              <p>This is a reminder that <strong>${escHtml(document.title)}</strong> is waiting for your signature.</p>
              <p style="margin: 24px 0;">
                <a href="${signingUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Review &amp; Sign Document
                </a>
              </p>
            </div>
          `,
        },
        user.id,
        project.id
      );
      sentCount++;

      insertAuditTrail({
        project_id: project.id,
        document_id: id,
        recipient_id: recipient.id,
        action: 'reminder_sent',
        actor_type: 'user',
        actor_id: user.id,
      });
    } catch (err) {
      console.error(`[CONTRACT_REMIND] Failed to send to ${recipient.email}:`, err);
    }
  }

  // Update last_reminder_at
  await adminClient
    .from('contract_documents')
    .update({ last_reminder_at: new Date().toISOString() })
    .eq('id', id)
    .eq('project_id', project.id);

  return NextResponse.json({ success: true, sent_count: sentCount });
}

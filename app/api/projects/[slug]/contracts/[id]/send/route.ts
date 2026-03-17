import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { sendContractSchema } from '@/lib/validators/contract';
import { insertAuditTrail, insertAuditTrailBatch } from '@/lib/contracts/audit';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { sendEmail } from '@/lib/gmail/service';
import type { GmailConnection } from '@/types/gmail';

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
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

  const body = await request.json();
  const result = sendContractSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 }
    );
  }

  // Get document
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

  if (document.status !== 'draft') {
    return NextResponse.json({ error: 'Contract has already been sent' }, { status: 400 });
  }

  // Validate Gmail connection
  const supabaseAny = supabase as ReturnType<typeof createClient> extends Promise<infer T> ? T : never;
  const { data: connection } = await (supabaseAny as unknown as { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: string) => { eq: (col: string, val: string) => { single: () => Promise<{ data: GmailConnection | null }> } } } } })
    .from('gmail_connections')
    .select('*')
    .eq('id', result.data.gmail_connection_id)
    .eq('user_id', user.id)
    .single();

  if (!connection) {
    return NextResponse.json({ error: 'Gmail connection not found' }, { status: 404 });
  }

  if ((connection as GmailConnection).status !== 'connected') {
    return NextResponse.json({ error: 'Gmail connection is not active' }, { status: 400 });
  }

  // Get signers
  const { data: recipients } = await supabase
    .from('contract_recipients')
    .select('*')
    .eq('document_id', id)
    .eq('project_id', project.id)
    .order('signing_order', { ascending: true });

  const signers = (recipients ?? []).filter((r) => r.role === 'signer');
  const unsupportedRecipients = (recipients ?? []).filter((r) => r.role !== 'signer');

  if (signers.length === 0) {
    return NextResponse.json({ error: 'Contract must have at least one signer' }, { status: 400 });
  }

  if (unsupportedRecipients.length > 0) {
    return NextResponse.json({
      error: 'Only signer recipients are currently supported for contract delivery',
    }, { status: 400 });
  }

  // Validate each signer has at least one field
  const { data: fields } = await supabase
    .from('contract_fields')
    .select('recipient_id')
    .eq('document_id', id)
    .eq('project_id', project.id);

  const recipientsWithFields = new Set((fields ?? []).map((f) => f.recipient_id));
  const signersWithoutFields = signers.filter((s) => !recipientsWithFields.has(s.id));

  if (signersWithoutFields.length > 0) {
    return NextResponse.json({
      error: `Signers without fields: ${signersWithoutFields.map((s) => s.name).join(', ')}`,
    }, { status: 400 });
  }

  // Validate signing_order contiguity for sequential
  if (document.signing_order_type === 'sequential') {
    const orders = [...new Set(signers.map((s) => s.signing_order))].sort((a, b) => a - b);
    for (let i = 0; i < orders.length; i++) {
      if (orders[i] !== i + 1) {
        return NextResponse.json({
          error: `Signing order must be contiguous (1, 2, 3...). Found gap at position ${i + 1}`,
        }, { status: 400 });
      }
    }
  }

  const adminClient = createServiceClient();
  const gmailConn = connection as GmailConnection;

  // Update document status to sent (CAS: only if still draft)
  const { data: updatedDoc, error: updateError } = await adminClient
    .from('contract_documents')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      gmail_connection_id: result.data.gmail_connection_id,
      sender_email: gmailConn.email,
    })
    .eq('id', id)
    .eq('project_id', project.id)
    .eq('status', 'draft')
    .select('id')
    .single();

  if (updateError || !updatedDoc) {
    console.error('[CONTRACT_SEND] Failed to update document status:', updateError);
    return NextResponse.json({ error: 'Failed to send contract — it may have already been sent' }, { status: 409 });
  }

  // Determine first group recipients
  const firstGroupOrder = document.signing_order_type === 'sequential' ? 1 : null;
  const firstGroupRecipients = firstGroupOrder
    ? (recipients ?? []).filter((r) => r.signing_order === 1)
    : (recipients ?? []);

  // Update first group recipients to 'sent' and send emails
  const auditEntries: Parameters<typeof insertAuditTrailBatch>[0] = [];
  const sendResults: Array<{ recipientId: string; success: boolean; error?: string }> = [];

  for (const recipient of firstGroupRecipients) {
    // Update status to sent
    await adminClient
      .from('contract_recipients')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', recipient.id);

    // Attempt email delivery
    try {
      const signingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/sign/${recipient.signing_token}`;
      await sendEmail(
        gmailConn,
        {
          to: recipient.email,
          subject: `Please sign: ${document.title}`,
          body_html: `
            <div style="font-family: sans-serif; max-width: 600px;">
              <h2>Document Ready for Signature</h2>
              <p>Hi ${escHtml(recipient.name)},</p>
              <p>${escHtml(gmailConn.email)} has sent you a document to ${recipient.role === 'signer' ? 'sign' : 'review'}: <strong>${escHtml(document.title)}</strong></p>
              ${result.data.message ? `<p>${escHtml(result.data.message)}</p>` : ''}
              <p style="margin: 24px 0;">
                <a href="${signingUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Review &amp; Sign Document
                </a>
              </p>
              <p style="color: #6b7280; font-size: 14px;">
                This link is unique to you. Do not share it with anyone.
              </p>
            </div>
          `,
        },
        user.id,
        project.id
      );
      sendResults.push({ recipientId: recipient.id, success: true });
    } catch (err) {
      console.error(`[CONTRACT_SEND] Failed to send email to ${recipient.email}:`, err);
      sendResults.push({
        recipientId: recipient.id,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      // Log send_failed but don't revert status
      auditEntries.push({
        project_id: project.id,
        document_id: id,
        recipient_id: recipient.id,
        action: 'send_failed',
        actor_type: 'system',
        details: { error: err instanceof Error ? err.message : 'Unknown error', email: recipient.email },
      });
    }
  }

  // Audit trail
  insertAuditTrail({
    project_id: project.id,
    document_id: id,
    action: 'sent',
    actor_type: 'user',
    actor_id: user.id,
    details: {
      recipient_count: firstGroupRecipients.length,
      failed_count: sendResults.filter((r) => !r.success).length,
    },
  });

  if (auditEntries.length > 0) {
    insertAuditTrailBatch(auditEntries);
  }

  // Activity log
  try {
    await adminClient.from('activity_log').insert({
      project_id: project.id,
      user_id: user.id,
      entity_type: 'contract',
      entity_id: id,
      action: 'sent',
      metadata: { title: document.title },
      opportunity_id: document.opportunity_id,
      organization_id: document.organization_id,
      person_id: document.person_id,
    });
  } catch (err) {
    console.error('[CONTRACT_SEND] Activity log failed:', err);
  }

  // Automation event
  emitAutomationEvent({
    projectId: project.id,
    triggerType: 'document.sent' as never,
    entityType: 'document' as never,
    entityId: id,
    data: { title: document.title, opportunity_id: document.opportunity_id },
  });

  const failedCount = sendResults.filter((r) => !r.success).length;

  return NextResponse.json({
    success: true,
    sent_count: sendResults.filter((r) => r.success).length,
    failed_count: failedCount,
    ...(failedCount > 0 && {
      warning: `${failedCount} email(s) failed to send. Recipients are marked as sent but may need a manual reminder.`,
    }),
  });
}

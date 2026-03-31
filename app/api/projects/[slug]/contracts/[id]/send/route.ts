import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { sendContractSchema } from '@/lib/validators/contract';
import { insertAuditTrail, insertAuditTrailBatch } from '@/lib/contracts/audit';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { sendEmail } from '@/lib/gmail/service';
import { resolveMergeFields } from '@/lib/contracts/merge-fields';
import type { GmailConnection } from '@/types/gmail';

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Strip dangerous HTML while keeping safe formatting tags from Tiptap */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\bon\w+\s*=/gi, 'data-removed=')
    .replace(/javascript\s*:/gi, 'blocked:');
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

  // BUG-BP fix: only members (owner/admin/member) may send contracts
  const { data: membership } = await supabase
    .from('project_memberships')
    .select('role')
    .eq('project_id', project.id)
    .eq('user_id', user.id)
    .single();

  if (!membership || membership.role === 'viewer') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
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
    .select('recipient_id, field_type, options')
    .eq('document_id', id)
    .eq('project_id', project.id);

  const recipientsWithFields = new Set((fields ?? []).map((f) => f.recipient_id));
  const signersWithoutFields = signers.filter((s) => !recipientsWithFields.has(s.id));

  if (signersWithoutFields.length > 0) {
    return NextResponse.json({
      error: `Signers without fields: ${signersWithoutFields.map((s) => s.name).join(', ')}`,
    }, { status: 400 });
  }

  const signerIds = new Set(signers.map((s) => s.id));
  const signerFields = (fields ?? []).filter((f) => signerIds.has(f.recipient_id));
  const signersWithSignatureField = new Set(
    signerFields
      .filter((f) => f.field_type === 'signature')
      .map((f) => f.recipient_id)
  );
  const signersWithoutSignatureField = signers.filter((s) => !signersWithSignatureField.has(s.id));

  if (signersWithoutSignatureField.length > 0) {
    return NextResponse.json({
      error: `Each signer must have a signature field. Missing: ${signersWithoutSignatureField.map((s) => s.name).join(', ')}`,
    }, { status: 400 });
  }

  // Validate dropdown fields have non-empty options
  const invalidDropdowns = signerFields.filter(
    (f) => f.field_type === 'dropdown' && (!f.options || !Array.isArray(f.options) || (f.options as string[]).filter((o) => o.trim()).length === 0)
  );
  if (invalidDropdowns.length > 0) {
    return NextResponse.json({
      error: 'Dropdown fields must have at least one non-empty option before sending',
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

  // CAS: Update document status to sent BEFORE merge field resolution.
  // If merge field resolution fails afterward, we revert the status.
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

  // Resolve merge field values after CAS succeeded
  let resolvedMergeValues: Record<string, string> = {};
  const { data: allFields, error: allFieldsError } = await adminClient
    .from('contract_fields')
    .select('id, auto_populate_from, value')
    .eq('document_id', id)
    .eq('project_id', project.id)
    .not('auto_populate_from', 'is', null);

  if (allFieldsError) {
    console.error('[CONTRACT_SEND] Failed to load merge fields, reverting status:', allFieldsError);
    // Revert CAS — set status back to draft
    await adminClient.from('contract_documents').update({ status: 'draft', sent_at: null, gmail_connection_id: null, sender_email: null }).eq('id', id);
    return NextResponse.json({ error: 'Failed to prepare merge fields before sending' }, { status: 500 });
  }

  const mergeFields = (allFields ?? []).filter((f) => f.auto_populate_from && !f.value);
  if (mergeFields.length > 0) {
    let resolveFailed = false;
    try {
      const keys = [...new Set(mergeFields.map((f) => f.auto_populate_from!))];
      resolvedMergeValues = await resolveMergeFields(keys, {
        projectId: project.id,
        personId: document.person_id,
        organizationId: document.organization_id,
        opportunityId: document.opportunity_id,
      });
    } catch (err) {
      resolveFailed = true;
      console.error('[CONTRACT_SEND] Merge field resolution failed, reverting status:', err);
    }

    if (resolveFailed) {
      // Revert CAS — set status back to draft
      await adminClient.from('contract_documents').update({ status: 'draft', sent_at: null, gmail_connection_id: null, sender_email: null }).eq('id', id);
      return NextResponse.json({ error: 'Failed to prepare merge fields before sending' }, { status: 500 });
    }
  }

  // Freeze merge field values now that CAS succeeded and resolution completed
  if (mergeFields.length > 0) {
    const frozenFieldIds: string[] = [];
    let freezeFailed = false;

    for (const field of mergeFields) {
      const val = resolvedMergeValues[field.auto_populate_from!];
      if (val) {
        const { error: mergeUpdateError } = await adminClient
          .from('contract_fields')
          .update({ value: val, filled_at: new Date().toISOString() })
          .eq('id', field.id);
        if (mergeUpdateError) {
          console.error('[CONTRACT_SEND] Failed to freeze merge field value, reverting:', mergeUpdateError);
          freezeFailed = true;
          break;
        }
        frozenFieldIds.push(field.id);
      }
    }

    if (freezeFailed) {
      // Revert already-frozen fields back to their original state
      if (frozenFieldIds.length > 0) {
        await adminClient
          .from('contract_fields')
          .update({ value: null, filled_at: null })
          .in('id', frozenFieldIds);
      }
      // Revert document status back to draft
      await adminClient.from('contract_documents').update({ status: 'draft', sent_at: null, gmail_connection_id: null, sender_email: null }).eq('id', id);
      return NextResponse.json({ error: 'Failed to prepare merge fields before sending' }, { status: 500 });
    }
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
    const { data: sentRecipient } = await adminClient
      .from('contract_recipients')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', recipient.id)
      .eq('status', 'pending')
      .select('id')
      .single();

    if (!sentRecipient) {
      sendResults.push({
        recipientId: recipient.id,
        success: false,
        error: 'Recipient status changed before send',
      });
      auditEntries.push({
        project_id: project.id,
        document_id: id,
        recipient_id: recipient.id,
        action: 'send_failed',
        actor_type: 'system',
        details: { error: 'Recipient status changed before send', email: recipient.email },
      });
      continue;
    }

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
              ${result.data.message ? `<div style="margin: 16px 0; padding: 12px; border-left: 3px solid #e5e7eb; color: #374151;">${sanitizeHtml(result.data.message)}</div>` : ''}
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

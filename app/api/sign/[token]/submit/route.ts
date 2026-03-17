import { NextResponse } from 'next/server';
import { validateSigningToken } from '@/lib/contracts/signing-token';
import { createServiceClient } from '@/lib/supabase/server';
import { insertAuditTrail, insertAuditTrailBatch } from '@/lib/contracts/audit';
import { checkRateLimit } from '@/lib/contracts/rate-limit';
import { submitSigningSchema } from '@/lib/validators/contract';
import { emitAutomationEvent } from '@/lib/automations/engine';

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ua = request.headers.get('user-agent') ?? '';

  const { allowed } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const result = await validateSigningToken(token, 'sign');
  if (!result.valid || !result.recipient || !result.document) {
    // Check if already signed (idempotent)
    if (result.error === 'Already signed') {
      return NextResponse.json({ already_signed: true }, { status: 200 });
    }
    return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
  }

  if (!result.recipient.consent_timestamp) {
    return NextResponse.json({ error: 'Must give consent before signing' }, { status: 400 });
  }

  const body = await request.json();
  const validation = submitSigningSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { recipient, document } = result;
  const supabase = createServiceClient();

  // Validate all required fields are filled
  const { data: fields } = await supabase
    .from('contract_fields')
    .select('id, field_type, is_required, value')
    .eq('document_id', recipient.document_id)
    .eq('recipient_id', recipient.id);

  // Apply submitted field values
  const fieldMap = new Map(validation.data.fields.map((f) => [f.field_id, f.value]));

  for (const field of fields ?? []) {
    const submittedValue = fieldMap.get(field.id);
    if (submittedValue !== undefined) {
      await supabase
        .from('contract_fields')
        .update({ value: submittedValue, filled_at: new Date().toISOString() })
        .eq('id', field.id)
        .eq('recipient_id', recipient.id);
    }
  }

  // Check required fields
  const { data: updatedFields } = await supabase
    .from('contract_fields')
    .select('id, is_required, value')
    .eq('document_id', recipient.document_id)
    .eq('recipient_id', recipient.id);

  const missingRequired = (updatedFields ?? []).filter((f) => f.is_required && !f.value);
  if (missingRequired.length > 0) {
    return NextResponse.json({
      error: `Missing ${missingRequired.length} required field(s)`,
    }, { status: 400 });
  }

  // === PHASE A: DB updates ===

  // Update recipient to signed (CAS: only if still sent/viewed)
  const { data: signedRecipient } = await supabase
    .from('contract_recipients')
    .update({
      status: 'signed',
      signed_at: new Date().toISOString(),
      signing_ip: ip,
      signing_user_agent: ua,
      signature_data: validation.data.signature_data,
      initials_data: validation.data.initials_data ?? null,
    })
    .eq('id', recipient.id)
    .in('status', ['sent', 'viewed'])
    .select('id')
    .single();

  if (!signedRecipient) {
    return NextResponse.json({ error: 'Recipient status changed, please refresh' }, { status: 409 });
  }

  // Audit trail
  const auditEntries = [
    {
      project_id: recipient.project_id,
      document_id: recipient.document_id,
      recipient_id: recipient.id,
      action: 'signed' as const,
      actor_type: 'signer' as const,
      actor_name: recipient.name,
      ip_address: ip,
      user_agent: ua,
    },
    {
      project_id: recipient.project_id,
      document_id: recipient.document_id,
      recipient_id: recipient.id,
      action: 'signature_adopted' as const,
      actor_type: 'signer' as const,
      actor_name: recipient.name,
      ip_address: ip,
      user_agent: ua,
      details: { type: validation.data.signature_data.type },
    },
  ];
  insertAuditTrailBatch(auditEntries);

  // === CAS: Group advancement (sequential) ===
  let groupAdvanced = false;
  if (document.signing_order_type === 'sequential') {
    const { data: casResult } = await supabase.rpc('advance_signing_group' as never, {
      p_document_id: document.id,
      p_current_group: recipient.signing_order,
    } as never) as { data: boolean | null };

    // If no RPC exists, do it manually
    if (casResult === null) {
      // Manual CAS: check if all signers in current group are signed
      const { data: groupSigners } = await supabase
        .from('contract_recipients')
        .select('id, status')
        .eq('document_id', document.id)
        .eq('role', 'signer')
        .eq('signing_order', recipient.signing_order);

      const allGroupSigned = (groupSigners ?? []).every((s) => s.status === 'signed');
      if (allGroupSigned) {
        const { data: advanced } = await supabase
          .from('contract_documents')
          .update({ current_signing_group: recipient.signing_order + 1 })
          .eq('id', document.id)
          .eq('signing_order_type', 'sequential')
          .eq('current_signing_group', recipient.signing_order)
          .select('current_signing_group')
          .single();

        groupAdvanced = !!advanced;
      }
    } else {
      groupAdvanced = !!casResult;
    }
  }

  // === CAS: Completion check ===
  let completionWon = false;
  const { data: allSigners } = await supabase
    .from('contract_recipients')
    .select('id, status')
    .eq('document_id', document.id)
    .eq('role', 'signer');

  const signerList = allSigners ?? [];
  const allSigned = signerList.length > 0 && signerList.every((s) => s.status === 'signed');
  if (allSigned) {
    // CAS: only one concurrent submit wins
    const { data: completed } = await supabase
      .from('contract_documents')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', document.id)
      .neq('status', 'completed')
      .select('id')
      .single();

    completionWon = !!completed;
  } else if (document.status !== 'partially_signed') {
    // Transition to partially_signed
    await supabase
      .from('contract_documents')
      .update({ status: 'partially_signed' })
      .eq('id', document.id)
      .in('status', ['sent', 'viewed']);
  }

  // === PHASE B: Post-commit side effects ===

  if (completionWon) {
    // Insert completion audit
    insertAuditTrail({
      project_id: recipient.project_id,
      document_id: document.id,
      action: 'completed',
      actor_type: 'system',
    });

    // Activity log
    try {
      await supabase.from('activity_log').insert({
        project_id: recipient.project_id,
        user_id: document.owner_id ?? document.created_by ?? 'system',
        entity_type: 'contract',
        entity_id: document.id,
        action: 'completed',
        metadata: { title: document.title },
      });
    } catch {
      // Non-critical
    }

    // Fire-and-forget: flatten PDF, generate certificate, send receipts
    import('@/lib/contracts/completion').then(({ handleCompletion }) => {
      handleCompletion(document.id, recipient.project_id).catch((err) => {
        console.error('[SIGN_SUBMIT] Completion handler failed (will retry via cron):', err);
      });
    });

    emitAutomationEvent({
      projectId: recipient.project_id,
      triggerType: 'document.completed' as never,
      entityType: 'document' as never,
      entityId: document.id,
      data: { title: document.title },
    });
  }

  if (groupAdvanced) {
    // Send emails to next group (Phase B, fire-and-forget)
    sendNextGroupEmails(supabase, document, recipient.signing_order + 1).catch((err) => {
      console.error('[SIGN_SUBMIT] Failed to send next group emails:', err);
    });
  }

  // Always emit signed event
  emitAutomationEvent({
    projectId: recipient.project_id,
    triggerType: 'document.signed' as never,
    entityType: 'document' as never,
    entityId: document.id,
    data: { title: document.title, signer_name: recipient.name, signer_email: recipient.email },
  });

  return NextResponse.json({
    success: true,
    completed: completionWon,
    group_advanced: groupAdvanced,
  });
}

async function sendNextGroupEmails(
  supabase: ReturnType<typeof createServiceClient>,
  document: NonNullable<Awaited<ReturnType<typeof validateSigningToken>>['document']>,
  nextGroup: number
) {
  // Get next group recipients
  const { data: nextRecipients } = await supabase
    .from('contract_recipients')
    .select('*')
    .eq('document_id', document.id)
    .eq('signing_order', nextGroup)
    .eq('status', 'pending');

  if (!nextRecipients || nextRecipients.length === 0) return;

  // Get gmail connection
  if (!document.gmail_connection_id) return;

  const { data: connection } = await (supabase as unknown as { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: string) => { single: () => Promise<{ data: { id: string; email: string; status: string } | null }> } } } })
    .from('gmail_connections')
    .select('*')
    .eq('id', document.gmail_connection_id)
    .single();

  if (!connection || connection.status !== 'connected') {
    insertAuditTrail({
      project_id: document.project_id,
      document_id: document.id,
      action: 'send_failed',
      actor_type: 'system',
      details: { reason: 'gmail_connection_expired', group: nextGroup },
    });
    return;
  }

  const { sendEmail } = await import('@/lib/gmail/service');

  for (const recipient of nextRecipients) {
    // Update to sent
    await supabase
      .from('contract_recipients')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', recipient.id);

    try {
      const signingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/sign/${recipient.signing_token}`;
      await sendEmail(
        connection as unknown as Parameters<typeof sendEmail>[0],
        {
          to: recipient.email,
          subject: `Please sign: ${document.title}`,
          body_html: `
            <div style="font-family: sans-serif; max-width: 600px;">
              <h2>Document Ready for Signature</h2>
              <p>Hi ${escHtml(recipient.name)},</p>
              <p>It's your turn to sign <strong>${escHtml(document.title)}</strong>.</p>
              <p style="margin: 24px 0;">
                <a href="${signingUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Review &amp; Sign Document
                </a>
              </p>
            </div>
          `,
        },
        'system',
        document.project_id
      );
    } catch (err) {
      console.error(`[SIGN_SUBMIT] Failed to send to ${recipient.email}:`, err);
      insertAuditTrail({
        project_id: document.project_id,
        document_id: document.id,
        recipient_id: recipient.id,
        action: 'send_failed',
        actor_type: 'system',
        details: { error: err instanceof Error ? err.message : 'Unknown' },
      });
    }
  }
}

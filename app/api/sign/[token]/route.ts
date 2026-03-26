import { NextResponse } from 'next/server';
import { validateSigningToken } from '@/lib/contracts/signing-token';
import { createServiceClient } from '@/lib/supabase/server';
import { insertAuditTrail } from '@/lib/contracts/audit';
import { checkRateLimit } from '@/lib/contracts/rate-limit';
import { notifyOwner } from '@/lib/contracts/notifications';
import type { ContractRecipientStatus } from '@/types/contract';

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  const { allowed } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const result = await validateSigningToken(token, 'view');
  if (!result.valid || !result.recipient || !result.document) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
  }

  const { recipient, document } = result;
  let effectiveRecipientStatus = recipient.status;
  let effectiveDocumentStatus = document.status;

  // Update recipient to 'viewed' if first view
  if (recipient.status === 'sent') {
    const supabase = createServiceClient();
    const { data: viewedRecipient } = await supabase
      .from('contract_recipients')
      .update({ status: 'viewed', viewed_at: new Date().toISOString() })
      .eq('id', recipient.id)
      .eq('status', 'sent')
      .select('status')
      .single();

    if (viewedRecipient?.status) {
      effectiveRecipientStatus = viewedRecipient.status as ContractRecipientStatus;

      // Update document to 'viewed' if first view (only after recipient CAS succeeds)
      if (document.status === 'sent') {
        const { data: viewedDocument } = await supabase
          .from('contract_documents')
          .update({ status: 'viewed' })
          .eq('id', document.id)
          .eq('status', 'sent')
          .select('status')
          .single();

        if (viewedDocument?.status) {
          effectiveDocumentStatus = viewedDocument.status;
        }
      }

      insertAuditTrail({
        project_id: recipient.project_id,
        document_id: recipient.document_id,
        recipient_id: recipient.id,
        action: 'viewed',
        actor_type: 'signer',
        actor_name: recipient.name,
        ip_address: ip,
        user_agent: request.headers.get('user-agent'),
      });
      // Fire-and-forget owner notification
      notifyOwner(document.id, 'viewed', { recipientName: recipient.name }).catch(() => {});
    }
  }

  // Fetch fields for this recipient
  const supabase = createServiceClient();
  const { data: fields } = await supabase
    .from('contract_fields')
    .select('id, field_type, label, placeholder, is_required, page_number, x, y, width, height, options, value')
    .eq('document_id', recipient.document_id)
    .eq('recipient_id', recipient.id)
    .order('page_number', { ascending: true });

  // Check if this is a lightweight waiver with HTML content
  const { data: docMeta } = await supabase
    .from('contract_documents')
    .select('custom_fields')
    .eq('id', recipient.document_id)
    .single();

  const customFields = docMeta?.custom_fields as Record<string, unknown> | null;
  const isLightweightWaiver = typeof customFields?.html_content === 'string';
  const documentKind = typeof customFields?.kind === 'string' ? customFields.kind : 'waiver';

  return NextResponse.json({
    document_title: document.title,
    page_count: document.page_count,
    recipient_name: recipient.name,
    recipient_email: recipient.email,
    recipient_status: effectiveRecipientStatus,
    document_status: effectiveDocumentStatus,
    consent_given: !!recipient.consent_timestamp,
    fields: (fields ?? []).map((f) => ({
      id: f.id,
      field_type: f.field_type,
      label: f.label,
      placeholder: f.placeholder,
      is_required: f.is_required,
      page_number: f.page_number,
      x: Number(f.x),
      y: Number(f.y),
      width: Number(f.width),
      height: Number(f.height),
      options: f.options,
      value: f.value,
    })),
    ...(isLightweightWaiver ? {
      document_kind: documentKind,
      waiver_html: customFields!.html_content as string,
    } : {}),
  });
}

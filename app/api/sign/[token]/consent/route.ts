import { NextResponse } from 'next/server';
import { validateSigningToken } from '@/lib/contracts/signing-token';
import { createServiceClient } from '@/lib/supabase/server';
import { insertAuditTrail } from '@/lib/contracts/audit';
import { checkRateLimit } from '@/lib/contracts/rate-limit';
import { consentSchema } from '@/lib/validators/contract';

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
  if (!result.valid || !result.recipient) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
  }

  const body = await request.json();
  const validation = consentSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: 'Consent is required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: liveDocument } = await supabase
    .from('contract_documents')
    .select('status, deleted_at')
    .eq('id', result.recipient.document_id)
    .single();

  if (!liveDocument || liveDocument.deleted_at || ['voided', 'expired', 'completed', 'declined'].includes(liveDocument.status)) {
    return NextResponse.json({ error: 'Document is no longer available for signing' }, { status: 409 });
  }

  const { data: liveRecipient } = await supabase
    .from('contract_recipients')
    .select('status')
    .eq('id', result.recipient.id)
    .single();

  if (!liveRecipient || !['sent', 'viewed'].includes(liveRecipient.status)) {
    return NextResponse.json({ error: 'Recipient status has changed' }, { status: 409 });
  }

  // Only record consent if not already given (immutable forensic record)
  const { data: updatedRecipient } = await supabase
    .from('contract_recipients')
    .update({
      consent_ip: ip,
      consent_user_agent: ua,
      consent_timestamp: new Date().toISOString(),
    })
    .eq('id', result.recipient.id)
    .is('consent_timestamp', null)
    .select('id')
    .single();

  if (updatedRecipient) {
    insertAuditTrail({
      project_id: result.recipient.project_id,
      document_id: result.recipient.document_id,
      recipient_id: result.recipient.id,
      action: 'consent_given',
      actor_type: 'signer',
      actor_name: result.recipient.name,
      ip_address: ip,
      user_agent: ua,
    });
  }

  return NextResponse.json({ success: true });
}

import { NextResponse } from 'next/server';
import { validateSigningToken } from '@/lib/contracts/signing-token';
import { createServiceClient } from '@/lib/supabase/server';
import { insertAuditTrail } from '@/lib/contracts/audit';
import { checkRateLimit } from '@/lib/contracts/rate-limit';
import { saveFieldsSchema } from '@/lib/validators/contract';

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
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

  // Only allow field writes for active (unsigned) recipients
  if (!['sent', 'viewed'].includes(result.recipient.status)) {
    return NextResponse.json({ error: 'Cannot update fields — recipient has already signed, declined, or been delegated' }, { status: 400 });
  }

  const body = await request.json();
  const validation = saveFieldsSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  for (const field of validation.data.fields) {
    await supabase
      .from('contract_fields')
      .update({
        value: field.value,
        filled_at: new Date().toISOString(),
      })
      .eq('id', field.field_id)
      .eq('recipient_id', result.recipient.id);

    insertAuditTrail({
      project_id: result.recipient.project_id,
      document_id: result.recipient.document_id,
      recipient_id: result.recipient.id,
      action: 'field_filled',
      actor_type: 'signer',
      actor_name: result.recipient.name,
      ip_address: ip,
      user_agent: ua,
      details: { field_id: field.field_id },
    });
  }

  return NextResponse.json({ success: true });
}

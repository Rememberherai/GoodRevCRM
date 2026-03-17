import { NextResponse } from 'next/server';
import { validateSigningToken } from '@/lib/contracts/signing-token';
import { createServiceClient } from '@/lib/supabase/server';
import { insertAuditTrail } from '@/lib/contracts/audit';
import { checkRateLimit } from '@/lib/contracts/rate-limit';
import { delegateSchema } from '@/lib/validators/contract';

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
    return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
  }

  const body = await request.json();
  const validation = delegateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { recipient, document } = result;
  const supabase = createServiceClient();

  // Prevent delegation to self
  if (validation.data.email.toLowerCase() === recipient.email.toLowerCase()) {
    return NextResponse.json({ error: 'Cannot delegate to yourself' }, { status: 400 });
  }

  // Limit delegation chain depth (max 5) — trace this recipient's chain
  let chainDepth = 0;
  let currentId: string | null = recipient.id;
  const { data: allRecipients } = await supabase
    .from('contract_recipients')
    .select('id, delegated_to_recipient_id')
    .eq('document_id', recipient.document_id)
    .eq('status', 'delegated');
  const delegationMap = new Map((allRecipients ?? []).map(r => [r.delegated_to_recipient_id, r.id]));
  // Walk backwards: who delegated to create currentId?
  while (currentId && delegationMap.has(currentId)) {
    chainDepth++;
    currentId = delegationMap.get(currentId) ?? null;
    if (chainDepth > 5) break;
  }
  if (chainDepth >= 5) {
    return NextResponse.json({ error: 'Maximum delegation depth reached' }, { status: 400 });
  }

  // Create successor recipient
  const { data: successor, error: createError } = await supabase
    .from('contract_recipients')
    .insert({
      project_id: recipient.project_id,
      document_id: recipient.document_id,
      name: validation.data.name,
      email: validation.data.email,
      role: recipient.role,
      signing_order: recipient.signing_order,
      status: 'pending',
    })
    .select()
    .single();

  if (createError || !successor) {
    console.error('[SIGN_DELEGATE] Failed to create successor:', createError);
    return NextResponse.json({ error: 'Failed to delegate' }, { status: 500 });
  }

  // Re-assign fields to successor and clear values
  const { data: originalFields } = await supabase
    .from('contract_fields')
    .select('id')
    .eq('document_id', recipient.document_id)
    .eq('recipient_id', recipient.id);

  const clearedFieldIds: string[] = [];
  for (const field of originalFields ?? []) {
    await supabase
      .from('contract_fields')
      .update({
        recipient_id: successor.id,
        value: null,
        filled_at: null,
      })
      .eq('id', field.id);
    clearedFieldIds.push(field.id);
  }

  // Mark original as delegated
  await supabase
    .from('contract_recipients')
    .update({
      status: 'delegated',
      delegated_to_recipient_id: successor.id,
      delegated_at: new Date().toISOString(),
    })
    .eq('id', recipient.id);

  insertAuditTrail({
    project_id: recipient.project_id,
    document_id: document.id,
    recipient_id: recipient.id,
    action: 'delegated',
    actor_type: 'signer',
    actor_name: recipient.name,
    ip_address: ip,
    user_agent: ua,
    details: {
      delegate_name: validation.data.name,
      delegate_email: validation.data.email,
      successor_id: successor.id,
      cleared_fields: clearedFieldIds,
    },
  });

  // Send signing email to delegate
  if (document.gmail_connection_id) {
    try {
      const { data: connection } = await (supabase as unknown as { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: string) => { single: () => Promise<{ data: { id: string; email: string; status: string } | null }> } } } })
        .from('gmail_connections')
        .select('*')
        .eq('id', document.gmail_connection_id)
        .single();

      if (connection && connection.status === 'connected') {
        // Update successor to sent
        await supabase
          .from('contract_recipients')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', successor.id);

        const { sendEmail } = await import('@/lib/gmail/service');
        const signingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/sign/${successor.signing_token}`;
        await sendEmail(
          connection as unknown as Parameters<typeof sendEmail>[0],
          {
            to: validation.data.email,
            subject: `Please sign: ${document.title}`,
            body_html: `
              <div style="font-family: sans-serif; max-width: 600px;">
                <h2>Document Ready for Signature</h2>
                <p>Hi ${escHtml(validation.data.name)},</p>
                <p>${escHtml(recipient.name)} has delegated the signing of <strong>${escHtml(document.title)}</strong> to you.</p>
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
      }
    } catch (err) {
      console.error('[SIGN_DELEGATE] Failed to send email:', err);
    }
  }

  return NextResponse.json({ success: true, successor_id: successor.id });
}

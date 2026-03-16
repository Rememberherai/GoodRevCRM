import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getValidAccessToken,
  GMAIL_API_URL,
  createAdminClient,
} from '@/lib/gmail/service';
import type { GmailConnection, GmailMessage } from '@/types/gmail';

export const maxDuration = 60;

/**
 * POST /api/gmail/bounce-scan
 * Scan Gmail for bounce-back emails and mark corresponding enrollments as bounced.
 *
 * Body: { connection_id: string, dry_run?: boolean }
 *
 * This searches Gmail for NDR/DSN messages, extracts the failed recipient,
 * and marks any active sequence enrollments for those recipients as bounced.
 */
export async function POST(request: Request) {
  // Support both session auth and CRON_SECRET bearer token
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isCronAuth = !!(cronSecret && authHeader === `Bearer ${cronSecret}`);

  let userId: string | null = null;

  if (!isCronAuth) {
    try {
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userId = user.id;
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let body: { connection_id?: string; dry_run?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.connection_id) {
    return NextResponse.json({ error: 'connection_id required' }, { status: 400 });
  }

  const dryRun = body.dry_run ?? false;
  const admin = createAdminClient();

  // For cron auth, just verify the connection exists; for user auth, verify ownership
  let connectionQuery = admin
    .from('gmail_connections')
    .select('*')
    .eq('id', body.connection_id);

  if (!isCronAuth && userId) {
    connectionQuery = connectionQuery.eq('user_id', userId);
  }

  const { data: connection, error: connError } = await connectionQuery.single();

  if (connError || !connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  try {
    const accessToken = await getValidAccessToken(connection as GmailConnection);

    // Search Gmail for bounce/NDR messages from the last 60 days
    const bounceQueries = [
      'from:mailer-daemon newer_than:60d',
      'from:postmaster newer_than:60d',
      'subject:"delivery status notification" newer_than:60d',
      'subject:"undeliverable" newer_than:60d',
      'subject:"delivery failure" newer_than:60d',
    ];

    const allMessageIds = new Set<string>();

    for (const query of bounceQueries) {
      let pageToken: string | undefined;
      do {
        const url = new URL(`${GMAIL_API_URL}/messages`);
        url.searchParams.set('q', query);
        url.searchParams.set('maxResults', '200');
        if (pageToken) url.searchParams.set('pageToken', pageToken);

        const response = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) break;
        const data = await response.json();
        if (data.messages) {
          for (const m of data.messages as { id: string }[]) {
            allMessageIds.add(m.id);
          }
        }
        pageToken = data.nextPageToken;
      } while (pageToken && allMessageIds.size < 500);
    }

    console.log(`[BounceScan] Found ${allMessageIds.size} potential bounce messages`);

    // Fetch full messages and extract bounced recipients
    const bouncedEmails: Map<string, { gmailMessageId: string; subject: string; date: string }> = new Map();
    const messageIds = [...allMessageIds];

    for (let i = 0; i < messageIds.length; i += 10) {
      const batch = messageIds.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map(async (id) => {
          const response = await fetch(
            `${GMAIL_API_URL}/messages/${id}?format=full`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (!response.ok) return null;
          return response.json() as Promise<GmailMessage>;
        })
      );

      for (const result of results) {
        if (result.status !== 'fulfilled' || !result.value) continue;
        const msg = result.value;

        const bodyText = extractTextFromMessage(msg);
        const subject = msg.payload.headers.find(
          h => h.name.toLowerCase() === 'subject'
        )?.value ?? '';
        const date = new Date(parseInt(msg.internalDate)).toISOString();

        const recipients = extractBouncedRecipientsFromText(bodyText, (connection as GmailConnection).email);
        for (const email of recipients) {
          if (!bouncedEmails.has(email)) {
            bouncedEmails.set(email, { gmailMessageId: msg.id, subject, date });
          }
        }
      }
    }

    console.log(`[BounceScan] Extracted ${bouncedEmails.size} unique bounced email addresses`);

    // Batch lookup: find all people by email in one query
    const bouncedEmailList = [...bouncedEmails.keys()];
    const personMap = new Map<string, { id: string; first_name: string | null; last_name: string | null }>();

    for (let i = 0; i < bouncedEmailList.length; i += 50) {
      const batch = bouncedEmailList.slice(i, i + 50);
      const { data: people } = await admin
        .from('people')
        .select('id, first_name, last_name, email')
        .in('email', batch);
      for (const p of (people ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string }[]) {
        personMap.set(p.email.toLowerCase(), p);
      }
    }

    // Batch lookup: get all active/paused enrollments with co_recipient_ids in one query
    const personIds = [...new Set([...personMap.values()].map(p => p.id))];

    // Primary enrollments (person_id matches)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let allPrimaryEnrollments: Array<{ id: string; sequence_id: string; person_id: string; sequences: { name: string } | null }> = [];
    for (let i = 0; i < personIds.length; i += 50) {
      const batch = personIds.slice(i, i + 50);
      const { data } = await admin
        .from('sequence_enrollments')
        .select('id, sequence_id, person_id, sequences(name)')
        .in('person_id', batch)
        .in('status', ['active', 'paused']);
      if (data) {
        for (const d of data) {
          allPrimaryEnrollments.push({
            id: d.id,
            sequence_id: d.sequence_id,
            person_id: d.person_id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sequences: (d as any).sequences?.[0] ?? (d as any).sequences ?? null,
          });
        }
      }
    }

    // Co-recipient enrollments (person appears in co_recipient_ids array)
    // Query all active enrollments that have any co_recipient_ids set
    const { data: rawCoEnrollments } = await admin
      .from('sequence_enrollments')
      .select('id, sequence_id, person_id, co_recipient_ids, sequences(name)')
      .in('status', ['active', 'paused'])
      .not('co_recipient_ids', 'eq', '{}');

    type CoEnrollment = { id: string; sequence_id: string; co_recipient_ids: string[]; sequences: { name: string } | null };

    // Build lookup: person_id -> co-recipient enrollments
    const coRecipientMap = new Map<string, CoEnrollment[]>();
    for (const enrollment of (rawCoEnrollments ?? [])) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = enrollment as any;
      const coIds: string[] = e.co_recipient_ids ?? [];
      const parsed: CoEnrollment = {
        id: e.id,
        sequence_id: e.sequence_id,
        co_recipient_ids: coIds,
        sequences: Array.isArray(e.sequences) ? e.sequences[0] : e.sequences ?? null,
      };
      for (const coId of coIds) {
        if (!coRecipientMap.has(coId)) coRecipientMap.set(coId, []);
        coRecipientMap.get(coId)!.push(parsed);
      }
    }

    const results: Array<{
      email: string;
      person_id: string | null;
      person_name: string | null;
      enrollment_id: string | null;
      sequence_name: string | null;
      action: string;
    }> = [];

    for (const [bouncedEmail, bounceInfo] of bouncedEmails) {
      const person = personMap.get(bouncedEmail.toLowerCase());

      if (!person) {
        results.push({
          email: bouncedEmail,
          person_id: null,
          person_name: null,
          enrollment_id: null,
          sequence_name: null,
          action: 'no_person_found',
        });
        continue;
      }

      const personName = `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim();

      // Primary enrollments for this person
      const enrollments = allPrimaryEnrollments.filter(e => e.person_id === person.id);

      // Co-recipient enrollments for this person
      const coEnrollments = coRecipientMap.get(person.id) ?? [];

      // Handle co-recipient bounces: remove from group, don't kill enrollment
      for (const coEnrollment of coEnrollments) {
        const seqName = (coEnrollment as unknown as { sequences: { name: string } | null }).sequences?.name ?? 'Unknown';
        const coIds = (coEnrollment as unknown as { co_recipient_ids: string[] }).co_recipient_ids ?? [];

        if (!dryRun) {
          const updatedCoRecipients = coIds.filter((id: string) => id !== person.id);
          await admin
            .from('sequence_enrollments')
            .update({ co_recipient_ids: updatedCoRecipients })
            .eq('id', coEnrollment.id);

          const { data: sentEmail } = await admin
            .from('sent_emails')
            .select('id')
            .eq('sequence_enrollment_id', coEnrollment.id)
            .order('sent_at', { ascending: false })
            .limit(1)
            .single();

          if (sentEmail) {
            await admin.from('email_events').insert({
              sent_email_id: sentEmail.id,
              event_type: 'bounce',
              occurred_at: new Date().toISOString(),
              metadata: {
                bounced_email: bouncedEmail,
                gmail_message_id: bounceInfo.gmailMessageId,
                bounce_subject: bounceInfo.subject,
                detection_method: 'bounce_scan',
                is_co_recipient: true,
              },
            });
          }

          const { data: seq } = await admin
            .from('sequences')
            .select('project_id, created_by')
            .eq('id', coEnrollment.sequence_id)
            .single();

          if (seq) {
            await admin.from('activity_log').insert({
              project_id: seq.project_id,
              user_id: seq.created_by,
              entity_type: 'person',
              entity_id: person.id,
              action: 'bounced',
              activity_type: 'email',
              outcome: 'email_bounced',
              direction: 'inbound',
              subject: `Email bounced — removed from "${seqName}" group`,
              notes: `Delivery to ${bouncedEmail} failed. Removed from grouped send (enrollment continues for other recipients).`,
              person_id: person.id,
              metadata: {
                sequence_id: coEnrollment.sequence_id,
                sequence_name: seqName,
                enrollment_id: coEnrollment.id,
                bounced_email: bouncedEmail,
                detection_method: 'bounce_scan',
              },
            });
          }
        }

        results.push({
          email: bouncedEmail,
          person_id: person.id,
          person_name: personName,
          enrollment_id: coEnrollment.id,
          sequence_name: seqName,
          action: dryRun ? 'would_remove_from_group' : 'removed_from_group',
        });
      }

      if (enrollments.length === 0) {
        if (coEnrollments.length === 0) {
          results.push({
            email: bouncedEmail,
            person_id: person.id,
            person_name: personName,
            enrollment_id: null,
            sequence_name: null,
            action: 'no_active_enrollment',
          });
        }
        continue;
      }

      // Handle primary enrollments: bounce the whole enrollment
      for (const enrollment of enrollments) {
        const seqName = enrollment.sequences?.name ?? 'Unknown';

        if (!dryRun) {
          await admin
            .from('sequence_enrollments')
            .update({
              status: 'bounced',
              bounce_detected_at: new Date().toISOString(),
              next_send_at: null,
            })
            .eq('id', enrollment.id);

          const { data: sentEmail } = await admin
            .from('sent_emails')
            .select('id')
            .eq('sequence_enrollment_id', enrollment.id)
            .order('sent_at', { ascending: false })
            .limit(1)
            .single();

          if (sentEmail) {
            await admin.from('email_events').insert({
              sent_email_id: sentEmail.id,
              event_type: 'bounce',
              occurred_at: new Date().toISOString(),
              metadata: {
                bounced_email: bouncedEmail,
                gmail_message_id: bounceInfo.gmailMessageId,
                bounce_subject: bounceInfo.subject,
                detection_method: 'bounce_scan',
              },
            });
          }

          const { data: seq } = await admin
            .from('sequences')
            .select('project_id, created_by')
            .eq('id', enrollment.sequence_id)
            .single();

          if (seq) {
            await admin.from('activity_log').insert({
              project_id: seq.project_id,
              user_id: seq.created_by,
              entity_type: 'person',
              entity_id: person.id,
              action: 'bounced',
              activity_type: 'email',
              outcome: 'email_bounced',
              direction: 'inbound',
              subject: `Email bounced — removed from "${seqName}"`,
              notes: `Delivery to ${bouncedEmail} failed. Enrollment was automatically stopped.`,
              person_id: person.id,
              metadata: {
                sequence_id: enrollment.sequence_id,
                sequence_name: seqName,
                enrollment_id: enrollment.id,
                bounced_email: bouncedEmail,
                detection_method: 'bounce_scan',
              },
            });
          }
        }

        results.push({
          email: bouncedEmail,
          person_id: person.id,
          person_name: personName,
          enrollment_id: enrollment.id,
          sequence_name: seqName,
          action: dryRun ? 'would_bounce' : 'bounced',
        });
      }
    }

    const bouncedCount = results.filter(r => r.action === 'bounced').length;
    const wouldBounceCount = results.filter(r => r.action === 'would_bounce').length;
    const removedFromGroupCount = results.filter(r => r.action === 'removed_from_group').length;
    const wouldRemoveFromGroupCount = results.filter(r => r.action === 'would_remove_from_group').length;

    return NextResponse.json({
      ok: true,
      dry_run: dryRun,
      bounce_messages_found: allMessageIds.size,
      unique_bounced_emails: bouncedEmails.size,
      enrollments_marked: dryRun ? 0 : bouncedCount,
      enrollments_would_mark: dryRun ? wouldBounceCount : undefined,
      co_recipients_removed: dryRun ? 0 : removedFromGroupCount,
      co_recipients_would_remove: dryRun ? wouldRemoveFromGroupCount : undefined,
      results,
    });
  } catch (error) {
    console.error('[BounceScan] Error:', error);
    return NextResponse.json({
      error: 'Bounce scan failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function extractTextFromMessage(msg: GmailMessage): string {
  let text = '';

  function walk(parts: GmailMessage['payload']['parts'], body?: { data?: string }, mimeType?: string) {
    if (body?.data && mimeType) {
      const decoded = Buffer.from(body.data, 'base64url').toString('utf-8');
      if (mimeType === 'text/plain') text += decoded + '\n';
      else if (mimeType === 'text/html' && !text) {
        text += decoded.replace(/<[^>]*>/g, ' ') + '\n';
      }
    }
    if (!parts) return;
    for (const part of parts) {
      if (part.body?.data) {
        const decoded = Buffer.from(part.body.data, 'base64url').toString('utf-8');
        if (part.mimeType === 'text/plain') text += decoded + '\n';
        else if (part.mimeType === 'text/html' && !text) {
          text += decoded.replace(/<[^>]*>/g, ' ') + '\n';
        }
      }
      if (part.parts) walk(part.parts);
    }
  }

  const topMime = msg.payload.headers.find(
    h => h.name.toLowerCase() === 'content-type'
  )?.value?.split(';')[0]?.trim();
  walk(msg.payload.parts, msg.payload.body, topMime);
  return text;
}

function extractBouncedRecipientsFromText(body: string, senderEmail?: string): string[] {
  const recipients: Set<string> = new Set();

  const EMAIL_RE = '([a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,})';

  // X-Failed-Recipients pattern
  const failedRecipMatch = body.match(/(?:failed|original)[\s-]*recipient[s]?[:\s]+([^\s<,]+@[^\s>,]+)/gi);
  if (failedRecipMatch) {
    for (const match of failedRecipMatch) {
      const emailMatch = match.match(new RegExp(EMAIL_RE));
      if (emailMatch) recipients.add(emailMatch[1]!.toLowerCase());
    }
  }

  // Gmail-specific patterns (most common):
  const patterns = [
    // Gmail: "wasn't delivered to" / "was not delivered to" / "not delivered to"
    new RegExp(`(?:wasn't|was not|not)\\s+delivered\\s+to\\s+<?${EMAIL_RE}>?`, 'gi'),
    // Gmail: "problem delivering your message to"
    new RegExp(`delivering\\s+(?:your\\s+)?(?:message\\s+)?to\\s+<?${EMAIL_RE}>?`, 'gi'),
    // Gmail: "could not deliver mail to"
    new RegExp(`could\\s+not\\s+deliver\\s+(?:mail\\s+)?to\\s+<?${EMAIL_RE}>?`, 'gi'),
    // SMTP error codes followed by email
    new RegExp(`(?:550|553|554|521|511|452)\\s+.*?<?${EMAIL_RE}>?`, 'gi'),
    // Generic: "delivery to <email>" / "rejected for <email>"
    new RegExp(`(?:delivery\\s+to|rejected\\s+for|bounced.*?address)[:\\s]*<?${EMAIL_RE}>?`, 'gi'),
    // Generic: "<email> was not delivered / does not exist / user unknown"
    new RegExp(`<?${EMAIL_RE}>?\\s+(?:was\\s+not\\s+delivered|could\\s+not\\s+be\\s+delivered|is\\s+not\\s+valid|does\\s+not\\s+exist|user\\s+unknown|no\\s+such\\s+user|mailbox\\s+unavailable|address\\s+rejected)`, 'gi'),
    // Google DSN: "The email account that you tried to reach does not exist"
    new RegExp(`email\\s+account.*?reach.*?<?${EMAIL_RE}>?`, 'gi'),
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(body)) !== null) {
      if (match[1]) recipients.add(match[1].toLowerCase());
    }
  }

  // Filter out sender email and Google internal addresses
  const sender = senderEmail?.toLowerCase();
  return [...recipients].filter(addr => {
    if (sender && addr === sender) return false;
    if (addr.endsWith('@mail.gmail.com')) return false;
    if (addr.endsWith('@googlemail.com')) return false;
    if (addr.startsWith('mailer-daemon@')) return false;
    if (addr.startsWith('postmaster@')) return false;
    return true;
  });
}

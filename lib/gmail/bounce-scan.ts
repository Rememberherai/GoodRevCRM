/**
 * Core bounce-scan logic — shared between the API route and the cron route.
 *
 * Scans Gmail for NDR/DSN messages, extracts bounced recipients,
 * creates bounce email_events, and marks enrollments as bounced.
 */

import {
  getValidAccessToken,
  GMAIL_API_URL,
  createAdminClient,
} from '@/lib/gmail/service';
import type { GmailConnection, GmailMessage } from '@/types/gmail';

export interface BounceScanResult {
  email: string;
  person_id: string | null;
  person_name: string | null;
  enrollment_id: string | null;
  sequence_name: string | null;
  action: string;
}

export interface BounceScanResponse {
  ok: boolean;
  dry_run: boolean;
  bounce_messages_found: number;
  unique_bounced_emails: number;
  bounce_events_created: number;
  enrollments_marked: number;
  enrollments_would_mark?: number;
  co_recipients_removed: number;
  co_recipients_would_remove?: number;
  results: BounceScanResult[];
}

export async function scanConnectionForBounces(
  connectionId: string,
  options?: { dryRun?: boolean; userId?: string | null }
): Promise<BounceScanResponse> {
  const dryRun = options?.dryRun ?? false;
  const userId = options?.userId ?? null;
  const admin = createAdminClient();

  // For user auth, verify ownership; otherwise just verify existence
  let connectionQuery = admin
    .from('gmail_connections')
    .select('*')
    .eq('id', connectionId);

  if (userId) {
    connectionQuery = connectionQuery.eq('user_id', userId);
  }

  const { data: connection, error: connError } = await connectionQuery.single();

  if (connError || !connection) {
    throw new Error('Connection not found');
  }

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

  // ── Step 1: Create email_events for ALL bounced emails by matching sent_emails ──
  const bouncedEmailList = [...bouncedEmails.keys()];
  let eventsCreated = 0;

  for (let i = 0; i < bouncedEmailList.length; i += 50) {
    const batch = bouncedEmailList.slice(i, i + 50);
    const orFilter = batch.map(e => `recipient_email.ilike.${e}`).join(',');
    const { data: sentEmails } = await admin
      .from('sent_emails')
      .select('id, recipient_email')
      .or(orFilter);

    if (sentEmails && !dryRun) {
      for (const se of sentEmails) {
        const bouncedEmail = se.recipient_email?.toLowerCase();
        if (!bouncedEmail) continue;
        const bounceInfo = bouncedEmails.get(bouncedEmail);
        if (!bounceInfo) continue;

        const { data: existing } = await admin
          .from('email_events')
          .select('id')
          .eq('sent_email_id', se.id)
          .eq('event_type', 'bounce')
          .limit(1);

        if (existing && existing.length > 0) continue;

        await admin.from('email_events').insert({
          sent_email_id: se.id,
          event_type: 'bounce',
          occurred_at: bounceInfo.date,
          metadata: {
            bounced_email: bouncedEmail,
            gmail_message_id: bounceInfo.gmailMessageId,
            bounce_subject: bounceInfo.subject,
            detection_method: 'bounce_scan',
          },
        });
        eventsCreated++;
      }
    }
  }

  console.log(`[BounceScan] Created ${eventsCreated} bounce email_events`);

  // ── Step 2: Batch lookup people for enrollment processing ──
  const personMap = new Map<string, { id: string; first_name: string | null; last_name: string | null }>();

  for (let i = 0; i < bouncedEmailList.length; i += 50) {
    const batch = bouncedEmailList.slice(i, i + 50);
    const orFilter = batch.map(e => `email.ilike.${e}`).join(',');
    const { data: people } = await admin
      .from('people')
      .select('id, first_name, last_name, email')
      .or(orFilter);
    for (const p of (people ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string }[]) {
      personMap.set(p.email.toLowerCase(), p);
    }
  }

  const personIds = [...new Set([...personMap.values()].map(p => p.id))];

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

  const { data: rawCoEnrollments } = await admin
    .from('sequence_enrollments')
    .select('id, sequence_id, person_id, co_recipient_ids, sequences(name)')
    .in('status', ['active', 'paused'])
    .not('co_recipient_ids', 'eq', '{}');

  type CoEnrollment = { id: string; sequence_id: string; co_recipient_ids: string[]; sequences: { name: string } | null };

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

  const scanResults: BounceScanResult[] = [];

  for (const [bouncedEmail, bounceInfo] of bouncedEmails) {
    const person = personMap.get(bouncedEmail.toLowerCase());

    if (!person) {
      scanResults.push({
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

    const enrollments = allPrimaryEnrollments.filter(e => e.person_id === person.id);
    const coEnrollments = coRecipientMap.get(person.id) ?? [];

    // Handle co-recipient bounces
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

      scanResults.push({
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
        scanResults.push({
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

    // Handle primary enrollments
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

      scanResults.push({
        email: bouncedEmail,
        person_id: person.id,
        person_name: personName,
        enrollment_id: enrollment.id,
        sequence_name: seqName,
        action: dryRun ? 'would_bounce' : 'bounced',
      });
    }
  }

  const bouncedCount = scanResults.filter(r => r.action === 'bounced').length;
  const wouldBounceCount = scanResults.filter(r => r.action === 'would_bounce').length;
  const removedFromGroupCount = scanResults.filter(r => r.action === 'removed_from_group').length;
  const wouldRemoveFromGroupCount = scanResults.filter(r => r.action === 'would_remove_from_group').length;

  return {
    ok: true,
    dry_run: dryRun,
    bounce_messages_found: allMessageIds.size,
    unique_bounced_emails: bouncedEmails.size,
    bounce_events_created: eventsCreated,
    enrollments_marked: dryRun ? 0 : bouncedCount,
    enrollments_would_mark: dryRun ? wouldBounceCount : undefined,
    co_recipients_removed: dryRun ? 0 : removedFromGroupCount,
    co_recipients_would_remove: dryRun ? wouldRemoveFromGroupCount : undefined,
    results: scanResults,
  };
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

  const failedRecipMatch = body.match(/(?:failed|original)[\s-]*recipient[s]?[:\s]+([^\s<,]+@[^\s>,]+)/gi);
  if (failedRecipMatch) {
    for (const match of failedRecipMatch) {
      const emailMatch = match.match(new RegExp(EMAIL_RE));
      if (emailMatch) recipients.add(emailMatch[1]!.toLowerCase());
    }
  }

  const patterns = [
    new RegExp(`(?:wasn't|was not|not)\\s+delivered\\s+to\\s+<?${EMAIL_RE}>?`, 'gi'),
    new RegExp(`delivering\\s+(?:your\\s+)?(?:message\\s+)?to\\s+<?${EMAIL_RE}>?`, 'gi'),
    new RegExp(`could\\s+not\\s+deliver\\s+(?:mail\\s+)?to\\s+<?${EMAIL_RE}>?`, 'gi'),
    new RegExp(`(?:550|553|554|521|511|452)\\s+.*?<?${EMAIL_RE}>?`, 'gi'),
    new RegExp(`(?:delivery\\s+to|rejected\\s+for|bounced.*?address)[:\\s]*<?${EMAIL_RE}>?`, 'gi'),
    new RegExp(`<?${EMAIL_RE}>?\\s+(?:was\\s+not\\s+delivered|could\\s+not\\s+be\\s+delivered|is\\s+not\\s+valid|does\\s+not\\s+exist|user\\s+unknown|no\\s+such\\s+user|mailbox\\s+unavailable|address\\s+rejected)`, 'gi'),
    new RegExp(`email\\s+account.*?reach.*?<?${EMAIL_RE}>?`, 'gi'),
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(body)) !== null) {
      if (match[1]) recipients.add(match[1].toLowerCase());
    }
  }

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

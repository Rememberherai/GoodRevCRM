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
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  // Verify connection ownership
  const { data: connection, error: connError } = await admin
    .from('gmail_connections')
    .select('*')
    .eq('id', body.connection_id)
    .eq('user_id', user.id)
    .single();

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

        const recipients = extractBouncedRecipientsFromText(bodyText);
        for (const email of recipients) {
          if (!bouncedEmails.has(email)) {
            bouncedEmails.set(email, { gmailMessageId: msg.id, subject, date });
          }
        }
      }
    }

    console.log(`[BounceScan] Extracted ${bouncedEmails.size} unique bounced email addresses`);

    // Now look up people and their active enrollments
    const results: Array<{
      email: string;
      person_id: string | null;
      person_name: string | null;
      enrollment_id: string | null;
      sequence_name: string | null;
      action: string;
    }> = [];

    for (const [bouncedEmail, bounceInfo] of bouncedEmails) {
      // Find person
      const { data: person } = await admin
        .from('people')
        .select('id, first_name, last_name')
        .ilike('email', bouncedEmail)
        .limit(1)
        .single();

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

      // Find active enrollments (could be multiple across sequences)
      const { data: enrollments } = await admin
        .from('sequence_enrollments')
        .select('id, sequence_id, status, sequences(name)')
        .eq('person_id', person.id)
        .in('status', ['active', 'paused'])
        .order('created_at', { ascending: false });

      if (!enrollments || enrollments.length === 0) {
        results.push({
          email: bouncedEmail,
          person_id: person.id,
          person_name: `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim(),
          enrollment_id: null,
          sequence_name: null,
          action: 'no_active_enrollment',
        });
        continue;
      }

      for (const enrollment of enrollments) {
        const seqName = (enrollment as unknown as { sequences: { name: string } | null }).sequences?.name ?? 'Unknown';

        if (!dryRun) {
          // Mark enrollment as bounced
          await admin
            .from('sequence_enrollments')
            .update({
              status: 'bounced',
              bounce_detected_at: new Date().toISOString(),
              next_send_at: null,
            })
            .eq('id', enrollment.id);

          // Record email_event if we have a sent_email
          const { data: sentEmail } = await admin
            .from('sent_emails')
            .select('id')
            .eq('sequence_enrollment_id', enrollment.id)
            .order('sent_at', { ascending: false })
            .limit(1)
            .single();

          if (sentEmail) {
            await admin
              .from('email_events')
              .insert({
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

          // Log activity on the person's timeline
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
          person_name: `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim(),
          enrollment_id: enrollment.id,
          sequence_name: seqName,
          action: dryRun ? 'would_bounce' : 'bounced',
        });
      }
    }

    const bouncedCount = results.filter(r => r.action === 'bounced').length;
    const wouldBounceCount = results.filter(r => r.action === 'would_bounce').length;

    return NextResponse.json({
      ok: true,
      dry_run: dryRun,
      bounce_messages_found: allMessageIds.size,
      unique_bounced_emails: bouncedEmails.size,
      enrollments_marked: dryRun ? 0 : bouncedCount,
      enrollments_would_mark: dryRun ? wouldBounceCount : undefined,
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

function extractBouncedRecipientsFromText(body: string): string[] {
  const recipients: Set<string> = new Set();

  // X-Failed-Recipients pattern
  const failedRecipMatch = body.match(/(?:failed|original)[\s-]*recipient[s]?[:\s]+([^\s<,]+@[^\s>,]+)/gi);
  if (failedRecipMatch) {
    for (const match of failedRecipMatch) {
      const emailMatch = match.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) recipients.add(emailMatch[1]!.toLowerCase());
    }
  }

  // Common bounce patterns
  const patterns = [
    /(?:delivery to|could not.*deliver.*to|rejected.*for|bounced.*address)[:\s]*<?([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})>?/gi,
    /<?([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})>?\s*(?:was not delivered|could not be delivered|is not valid|does not exist|user unknown|no such user|mailbox unavailable|address rejected)/gi,
    /(?:550|553|554|521|511)[\s\-#]+.*?<?([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})>?/gi,
    /The email account that you tried to reach does not exist[^<]*<?([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})>?/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(body)) !== null) {
      if (match[1]) recipients.add(match[1].toLowerCase());
    }
  }

  return [...recipients];
}

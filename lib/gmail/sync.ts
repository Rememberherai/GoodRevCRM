import { getValidAccessToken, GMAIL_API_URL, createAdminClient, GmailServiceError } from './service';
import { matchEmailAddress, bulkMatchEmails, type MatchResult } from './contact-matcher';
import type { GmailConnection, GmailMessage, GmailMessagePart } from '@/types/gmail';

const MAX_CONSECUTIVE_ERRORS = 5;
const BATCH_SIZE = 10;
const INITIAL_SYNC_DAYS = 30;
const MAX_INITIAL_MESSAGES = 500;

interface SyncResult {
  messages_fetched: number;
  messages_stored: number;
  contacts_matched: number;
  error?: string;
}

// ─── Watch Management ───────────────────────────────────────────────

/**
 * Register Gmail push notifications for a connection
 */
export async function registerWatch(connection: GmailConnection): Promise<{ historyId: string; expiration: string }> {
  const accessToken = await getValidAccessToken(connection);
  const topic = process.env.GMAIL_PUBSUB_TOPIC;

  if (!topic) {
    throw new GmailServiceError('GMAIL_PUBSUB_TOPIC environment variable not set', 'config_error');
  }

  const response = await fetch(`${GMAIL_API_URL}/watch`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topicName: topic,
      labelIds: ['INBOX'],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[EmailSync] Watch registration failed:', errorBody);
    throw new GmailServiceError('Failed to register Gmail watch', 'watch_failed', response.status);
  }

  const data = await response.json();
  return {
    historyId: data.historyId,
    expiration: new Date(parseInt(data.expiration)).toISOString(),
  };
}

/**
 * Stop Gmail push notifications for a connection
 */
export async function stopWatch(connection: GmailConnection): Promise<void> {
  const accessToken = await getValidAccessToken(connection);

  const response = await fetch(`${GMAIL_API_URL}/stop`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    console.error('[EmailSync] Stop watch failed:', await response.text());
    // Don't throw — best effort
  }
}

// ─── Message Parsing ────────────────────────────────────────────────

function getHeader(message: GmailMessage, name: string): string | null {
  const header = message.payload.headers.find(
    h => h.name.toLowerCase() === name.toLowerCase()
  );
  return header?.value ?? null;
}

function parseEmailAddress(raw: string): { email: string; name: string | null } {
  // Handle "Name <email@example.com>" format
  const match = raw.match(/^(?:"?([^"]*)"?\s*)?<?([^\s<>]+@[^\s<>]+)>?$/);
  if (match) {
    return { email: (match[2] ?? raw).toLowerCase(), name: match[1]?.trim() || null };
  }
  return { email: raw.toLowerCase().trim(), name: null };
}

function parseEmailList(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(',').map(addr => {
    const { email } = parseEmailAddress(addr.trim());
    return email;
  }).filter(Boolean);
}

/**
 * Recursively extract body content from MIME parts
 */
function extractBody(payload: GmailMessage['payload']): { html: string | null; text: string | null } {
  let html: string | null = null;
  let text: string | null = null;

  function walk(parts: GmailMessagePart[] | undefined, body?: { data?: string }, mimeType?: string) {
    // Check top-level body
    if (body?.data && mimeType) {
      const decoded = Buffer.from(body.data, 'base64url').toString('utf-8');
      if (mimeType === 'text/html' && !html) html = decoded;
      if (mimeType === 'text/plain' && !text) text = decoded;
    }

    if (!parts) return;
    for (const part of parts) {
      if (part.body?.data) {
        const decoded = Buffer.from(part.body.data, 'base64url').toString('utf-8');
        if (part.mimeType === 'text/html' && !html) html = decoded;
        if (part.mimeType === 'text/plain' && !text) text = decoded;
      }
      if (part.parts) {
        walk(part.parts);
      }
    }
  }

  // Handle single-part messages
  const topMimeType = payload.headers.find(h => h.name.toLowerCase() === 'content-type')?.value?.split(';')[0]?.trim();
  walk(payload.parts, payload.body, topMimeType);
  return { html, text };
}

/**
 * Extract attachment metadata from a Gmail message
 */
function extractAttachments(payload: GmailMessage['payload']): Array<{
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}> {
  const attachments: Array<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
  }> = [];

  function walk(parts: GmailMessagePart[] | undefined) {
    if (!parts) return;
    for (const part of parts) {
      if (part.filename && part.body?.size && part.body.size > 0) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body.size,
          attachmentId: part.body.data ?? part.partId,
        });
      }
      if (part.parts) walk(part.parts);
    }
  }

  walk(payload.parts);
  return attachments;
}

/**
 * Parse a Gmail API message into our email record format
 */
function parseGmailMessage(message: GmailMessage, connectionEmail: string) {
  const fromRaw = getHeader(message, 'From') ?? '';
  const { email: fromEmail, name: fromName } = parseEmailAddress(fromRaw);
  const toEmails = parseEmailList(getHeader(message, 'To'));
  const ccEmails = parseEmailList(getHeader(message, 'Cc'));
  const bccEmails = parseEmailList(getHeader(message, 'Bcc'));
  const subject = getHeader(message, 'Subject');
  const { html, text } = extractBody(message.payload);
  const attachments = extractAttachments(message.payload);

  const direction = fromEmail.toLowerCase() === connectionEmail.toLowerCase() ? 'outbound' : 'inbound';

  return {
    gmail_message_id: message.id,
    gmail_thread_id: message.threadId,
    direction,
    from_email: fromEmail,
    from_name: fromName,
    to_emails: toEmails,
    cc_emails: ccEmails,
    bcc_emails: bccEmails,
    subject,
    snippet: message.snippet,
    body_html: html,
    body_text: text,
    email_date: new Date(parseInt(message.internalDate)).toISOString(),
    label_ids: message.labelIds ?? [],
    attachments,
  };
}

// ─── Gmail API Helpers ──────────────────────────────────────────────

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, options);
    if (response.ok) return response;
    if (response.status === 429 || response.status >= 500) {
      // Rate limited or server error — backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      continue;
    }
    return response; // Client error — don't retry
  }
  return fetch(url, options); // Final attempt
}

async function fetchMessage(accessToken: string, messageId: string): Promise<GmailMessage | null> {
  const response = await fetchWithRetry(
    `${GMAIL_API_URL}/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) {
    console.error(`[EmailSync] Failed to fetch message ${messageId}: ${response.status}`);
    return null;
  }
  return response.json();
}

async function batchFetchMessages(accessToken: string, messageIds: string[]): Promise<GmailMessage[]> {
  const messages: GmailMessage[] = [];

  // Process in batches to respect rate limits
  for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
    const batch = messageIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(id => fetchMessage(accessToken, id))
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        messages.push(result.value);
      }
    }
  }

  return messages;
}

// ─── Core Sync Logic ────────────────────────────────────────────────

/**
 * Perform initial sync — fetch last 30 days of messages
 */
async function performInitialSync(
  connection: GmailConnection,
  accessToken: string,
  supabase: ReturnType<typeof createAdminClient>
): Promise<SyncResult> {
  const result: SyncResult = { messages_fetched: 0, messages_stored: 0, contacts_matched: 0 };

  // List recent messages
  let messageIds: string[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${GMAIL_API_URL}/messages`);
    url.searchParams.set('q', `newer_than:${INITIAL_SYNC_DAYS}d`);
    url.searchParams.set('maxResults', '200');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const response = await fetchWithRetry(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new GmailServiceError(`Failed to list messages: ${response.status}`, 'list_failed', response.status);
    }

    const data = await response.json();
    if (data.messages) {
      messageIds.push(...data.messages.map((m: { id: string }) => m.id));
    }
    pageToken = data.nextPageToken;
  } while (pageToken && messageIds.length < MAX_INITIAL_MESSAGES);

  if (messageIds.length > MAX_INITIAL_MESSAGES) {
    messageIds.length = MAX_INITIAL_MESSAGES;
  }

  if (messageIds.length === 0) {
    // No messages — just get current historyId
    const profileResponse = await fetchWithRetry(
      `${GMAIL_API_URL}/profile`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const profile = await profileResponse.json();

    await supabase
      .from('gmail_connections')
      .update({
        history_id: profile.historyId,
        initial_sync_done: true,
        last_sync_at: new Date().toISOString(),
        sync_errors_count: 0,
        last_sync_error: null,
      })
      .eq('id', connection.id);

    return result;
  }

  // Fetch full messages in batches
  const messages = await batchFetchMessages(accessToken, messageIds);
  result.messages_fetched = messages.length;

  // Parse messages
  const parsed = messages.map(msg => parseGmailMessage(msg, connection.email));

  // Bulk match contacts
  const allEmails = parsed.map(p =>
    p.direction === 'inbound' ? p.from_email : (p.to_emails[0] ?? null)
  ).filter((e): e is string => e !== null && e !== undefined);

  const matches = await bulkMatchEmails(allEmails, connection.user_id, supabase);

  // Insert emails
  for (const email of parsed) {
    const contactEmail = email.direction === 'inbound' ? email.from_email : (email.to_emails[0] ?? null);
    const match = contactEmail ? matches.get(contactEmail.toLowerCase()) : undefined;

    // Only store emails that match known contacts
    if (!match) continue;

    const { error } = await supabase
      .from('emails')
      .upsert({
        gmail_connection_id: connection.id,
        user_id: connection.user_id,
        gmail_message_id: email.gmail_message_id,
        gmail_thread_id: email.gmail_thread_id,
        direction: email.direction,
        from_email: email.from_email,
        from_name: email.from_name,
        to_emails: email.to_emails,
        cc_emails: email.cc_emails,
        bcc_emails: email.bcc_emails,
        subject: email.subject,
        snippet: email.snippet,
        body_html: email.body_html,
        body_text: email.body_text,
        email_date: email.email_date,
        label_ids: email.label_ids,
        attachments: email.attachments,
        person_id: match.person_id,
        organization_id: match.organization_id,
        project_id: match.project_id,
      }, {
        onConflict: 'gmail_connection_id,gmail_message_id',
        ignoreDuplicates: true,
      });

    if (!error) {
      result.messages_stored++;
      if (match.person_id || match.organization_id) {
        result.contacts_matched++;

        // Log activity for inbound emails only when a person is matched
        // (domain-only org matches would create noise from system emails)
        if (email.direction === 'inbound' && match.project_id && match.person_id) {
          await logEmailActivity(supabase, connection, email, match);
        }
      }
    }
  }

  // Get the latest historyId from the profile
  const profileResponse = await fetchWithRetry(
    `${GMAIL_API_URL}/profile`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const profile = await profileResponse.json();

  // Update connection state
  await supabase
    .from('gmail_connections')
    .update({
      history_id: profile.historyId,
      initial_sync_done: true,
      last_sync_at: new Date().toISOString(),
      sync_errors_count: 0,
      last_sync_error: null,
    })
    .eq('id', connection.id);

  return result;
}

/**
 * Perform incremental sync using History API
 */
async function performIncrementalSync(
  connection: GmailConnection,
  accessToken: string,
  supabase: ReturnType<typeof createAdminClient>
): Promise<SyncResult> {
  const result: SyncResult = { messages_fetched: 0, messages_stored: 0, contacts_matched: 0 };

  if (!connection.history_id) {
    // No history_id — fall back to initial sync
    return performInitialSync(connection, accessToken, supabase);
  }

  // Fetch history since last sync
  const url = new URL(`${GMAIL_API_URL}/history`);
  url.searchParams.set('startHistoryId', connection.history_id);
  url.searchParams.set('historyTypes', 'messageAdded');
  url.searchParams.set('labelId', 'INBOX');

  const response = await fetchWithRetry(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 404) {
    // History ID too old — re-sync
    console.log('[EmailSync] History ID expired, falling back to initial sync');
    await supabase
      .from('gmail_connections')
      .update({ initial_sync_done: false })
      .eq('id', connection.id);
    return performInitialSync(connection, accessToken, supabase);
  }

  if (!response.ok) {
    throw new GmailServiceError(`History list failed: ${response.status}`, 'history_failed', response.status);
  }

  const data = await response.json();

  // Collect new message IDs
  const messageIds = new Set<string>();
  if (data.history) {
    for (const record of data.history) {
      if (record.messagesAdded) {
        for (const added of record.messagesAdded) {
          messageIds.add(added.message.id);
        }
      }
    }
  }

  if (messageIds.size === 0) {
    // No new messages — just update historyId
    if (data.historyId) {
      await supabase
        .from('gmail_connections')
        .update({
          history_id: data.historyId,
          last_sync_at: new Date().toISOString(),
          sync_errors_count: 0,
          last_sync_error: null,
        })
        .eq('id', connection.id);
    }
    return result;
  }

  // Fetch full messages
  const messages = await batchFetchMessages(accessToken, [...messageIds]);
  result.messages_fetched = messages.length;

  // Parse and match
  for (const msg of messages) {
    const parsed = parseGmailMessage(msg, connection.email);
    const contactEmail = parsed.direction === 'inbound' ? parsed.from_email : (parsed.to_emails[0] ?? null);

    if (!contactEmail) continue;

    const match = await matchEmailAddress(contactEmail, connection.user_id, supabase);
    if (!match.person_id && !match.organization_id) continue;

    // Check if this outbound message has a sent_emails record
    let sentEmailId: string | null = null;
    if (parsed.direction === 'outbound') {
      const { data: sentEmail } = await supabase
        .from('sent_emails')
        .select('id')
        .eq('message_id', parsed.gmail_message_id)
        .limit(1)
        .single();
      sentEmailId = sentEmail?.id ?? null;
    }

    const { error } = await supabase
      .from('emails')
      .upsert({
        gmail_connection_id: connection.id,
        user_id: connection.user_id,
        gmail_message_id: parsed.gmail_message_id,
        gmail_thread_id: parsed.gmail_thread_id,
        direction: parsed.direction,
        from_email: parsed.from_email,
        from_name: parsed.from_name,
        to_emails: parsed.to_emails,
        cc_emails: parsed.cc_emails,
        bcc_emails: parsed.bcc_emails,
        subject: parsed.subject,
        snippet: parsed.snippet,
        body_html: parsed.body_html,
        body_text: parsed.body_text,
        email_date: parsed.email_date,
        label_ids: parsed.label_ids,
        attachments: parsed.attachments,
        person_id: match.person_id,
        organization_id: match.organization_id,
        project_id: match.project_id,
        sent_email_id: sentEmailId,
      }, {
        onConflict: 'gmail_connection_id,gmail_message_id',
        ignoreDuplicates: true,
      });

    if (!error) {
      result.messages_stored++;
      result.contacts_matched++;

      // Log activity for inbound emails only when a person is matched
      // (domain-only org matches would create noise from system emails)
      if (parsed.direction === 'inbound' && match.project_id && match.person_id) {
        await logEmailActivity(supabase, connection, parsed, match);
      }
    }
  }

  // Update connection with latest historyId
  const newHistoryId = data.historyId ?? connection.history_id;
  await supabase
    .from('gmail_connections')
    .update({
      history_id: newHistoryId,
      last_sync_at: new Date().toISOString(),
      sync_errors_count: 0,
      last_sync_error: null,
    })
    .eq('id', connection.id);

  return result;
}

/**
 * Log an inbound email as a CRM activity
 */
async function logEmailActivity(
  supabase: ReturnType<typeof createAdminClient>,
  connection: GmailConnection,
  email: ReturnType<typeof parseGmailMessage>,
  match: MatchResult
): Promise<void> {
  try {
    // Use person as entity context if matched, otherwise skip (entity_id must be a valid UUID)
    const entityId = match.person_id ?? match.organization_id;
    if (!entityId) return;

    const entityType = match.person_id ? 'person' : 'organization';

    await supabase.from('activity_log').insert({
      project_id: match.project_id,
      user_id: connection.user_id,
      entity_type: entityType,
      entity_id: entityId,
      action: 'logged',
      activity_type: 'email',
      outcome: 'email_received',
      direction: 'inbound',
      subject: email.subject,
      notes: email.body_html || email.body_text || email.snippet,
      person_id: match.person_id,
      organization_id: match.organization_id,
      metadata: {
        gmail_message_id: email.gmail_message_id,
        gmail_thread_id: email.gmail_thread_id,
        from: email.from_email,
        to: email.to_emails,
      },
    });
  } catch (err) {
    console.error('[EmailSync] Failed to log activity:', err);
    // Non-fatal — don't fail the sync
  }
}

// ─── Main Entry Point ───────────────────────────────────────────────

/**
 * Sync emails for a Gmail connection (called by webhook or manual trigger)
 */
export async function syncEmailsForConnection(connectionId: string): Promise<SyncResult> {
  const supabase = createAdminClient();

  // Fetch connection
  const { data: connection, error: connError } = await supabase
    .from('gmail_connections')
    .select('*')
    .eq('id', connectionId)
    .single();

  if (connError || !connection) {
    throw new GmailServiceError('Connection not found', 'not_found');
  }

  if (connection.status !== 'connected' || !connection.sync_enabled) {
    return { messages_fetched: 0, messages_stored: 0, contacts_matched: 0 };
  }

  // Create sync log entry
  const syncType = connection.initial_sync_done ? 'incremental' : 'initial';
  const { data: syncLog } = await supabase
    .from('email_sync_log')
    .insert({
      gmail_connection_id: connectionId,
      sync_type: syncType,
    })
    .select('id')
    .single();

  try {
    const accessToken = await getValidAccessToken(connection as GmailConnection);

    // Check if watch needs renewal (within 1 day of expiration)
    if (connection.watch_expiration) {
      const expiration = new Date(connection.watch_expiration);
      const oneDayFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      if (expiration < oneDayFromNow) {
        try {
          const watchResult = await registerWatch(connection as GmailConnection);
          await supabase
            .from('gmail_connections')
            .update({ watch_expiration: watchResult.expiration })
            .eq('id', connectionId);
        } catch (watchErr) {
          console.error('[EmailSync] Watch renewal failed:', watchErr);
          // Non-fatal — sync can still proceed
        }
      }
    }

    // Perform sync
    const result = connection.initial_sync_done
      ? await performIncrementalSync(connection as GmailConnection, accessToken, supabase)
      : await performInitialSync(connection as GmailConnection, accessToken, supabase);

    // Update sync log
    if (syncLog?.id) {
      await supabase
        .from('email_sync_log')
        .update({
          completed_at: new Date().toISOString(),
          messages_fetched: result.messages_fetched,
          messages_stored: result.messages_stored,
          contacts_matched: result.contacts_matched,
        })
        .eq('id', syncLog.id);
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[EmailSync] Sync failed for connection ${connectionId}:`, error);

    // Increment error count
    const newErrorCount = (connection.sync_errors_count ?? 0) + 1;
    const updateData: Record<string, unknown> = {
      sync_errors_count: newErrorCount,
      last_sync_error: errorMessage,
    };

    // Circuit breaker: disable after too many consecutive failures
    if (newErrorCount >= MAX_CONSECUTIVE_ERRORS) {
      updateData.sync_enabled = false;
      console.error(`[EmailSync] Circuit breaker: disabled sync for ${connectionId} after ${newErrorCount} errors`);
    }

    await supabase
      .from('gmail_connections')
      .update(updateData)
      .eq('id', connectionId);

    // Update sync log with error
    if (syncLog?.id) {
      await supabase
        .from('email_sync_log')
        .update({
          completed_at: new Date().toISOString(),
          error_message: errorMessage,
        })
        .eq('id', syncLog.id);
    }

    return { messages_fetched: 0, messages_stored: 0, contacts_matched: 0, error: errorMessage };
  }
}

// Gmail connection status
export type GmailConnectionStatus = 'connected' | 'disconnected' | 'expired' | 'error';

// Gmail connection (database type will be added after migration)
export interface GmailConnection {
  id: string;
  user_id: string;
  project_id: string | null;
  email: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  status: GmailConnectionStatus;
  last_sync_at: string | null;
  // Sync state
  history_id: string | null;
  initial_sync_done: boolean;
  sync_errors_count: number;
  last_sync_error: string | null;
  sync_enabled: boolean;
  watch_expiration: string | null;
  created_at: string;
  updated_at: string;
}

// Sent email record
export interface SentEmail {
  id: string;
  project_id: string | null;
  gmail_connection_id: string;
  person_id: string | null;
  organization_id: string | null;
  opportunity_id: string | null;
  rfp_id: string | null;
  sequence_enrollment_id: string | null;
  thread_id: string | null;
  message_id: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  tracking_id: string;
  sent_at: string;
  created_by: string;
}

// Email event types
export type EmailEventType = 'open' | 'click' | 'bounce' | 'reply';

// Email event record
export interface EmailEvent {
  id: string;
  sent_email_id: string;
  event_type: EmailEventType;
  occurred_at: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  link_url: string | null;
}

// Email tracking stats
export interface EmailTrackingStats {
  opens: number;
  unique_opens: number;
  clicks: number;
  unique_clicks: number;
  replies: number;
  bounces: number;
  first_open_at: string | null;
  last_open_at: string | null;
}

// Gmail OAuth tokens from Google
export interface GoogleOAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
}

// Gmail user profile
export interface GmailProfile {
  email: string;
  name?: string;
  picture?: string;
}

// Send email input
export interface SendEmailInput {
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body_html: string;
  body_text?: string;
  reply_to_message_id?: string;
  thread_id?: string;
  // Entity associations
  person_id?: string;
  organization_id?: string;
  opportunity_id?: string;
  rfp_id?: string;
}

// Send email result
export interface SendEmailResult {
  message_id: string;
  thread_id: string;
  tracking_id: string;
  sent_email_id: string | null;
}

// Gmail API message format
export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: { name: string; value: string }[];
    body?: { data?: string };
    parts?: GmailMessagePart[];
  };
  internalDate: string;
}

export interface GmailMessagePart {
  partId: string;
  mimeType: string;
  filename?: string;
  body?: { data?: string; size?: number };
  parts?: GmailMessagePart[];
}

// Status labels and colors
export const CONNECTION_STATUS_LABELS: Record<GmailConnectionStatus, string> = {
  connected: 'Connected',
  disconnected: 'Disconnected',
  expired: 'Token Expired',
  error: 'Error',
};

export const CONNECTION_STATUS_COLORS: Record<GmailConnectionStatus, string> = {
  connected: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  disconnected: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  expired: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export const EVENT_TYPE_LABELS: Record<EmailEventType, string> = {
  open: 'Opened',
  click: 'Clicked',
  bounce: 'Bounced',
  reply: 'Replied',
};

// Synced email record (inbound + outbound)
export interface SyncedEmail {
  id: string;
  gmail_connection_id: string;
  user_id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  direction: 'inbound' | 'outbound';
  from_email: string;
  from_name: string | null;
  to_emails: string[];
  cc_emails: string[];
  bcc_emails: string[];
  subject: string | null;
  snippet: string | null;
  body_html: string | null;
  body_text: string | null;
  email_date: string;
  label_ids: string[];
  attachments: EmailAttachmentMeta[];
  person_id: string | null;
  organization_id: string | null;
  opportunity_id: string | null;
  rfp_id: string | null;
  project_id: string | null;
  sent_email_id: string | null;
  synced_at: string;
  created_at: string;
}

export interface EmailAttachmentMeta {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

export interface EmailThread {
  thread_id: string;
  subject: string | null;
  messages: SyncedEmail[];
  person_id: string | null;
  organization_id: string | null;
  latest_date: string;
  message_count: number;
}

export interface EmailSyncStatus {
  connection_id: string;
  email: string;
  sync_enabled: boolean;
  initial_sync_done: boolean;
  last_sync_at: string | null;
  sync_errors_count: number;
  last_sync_error: string | null;
  watch_expiration: string | null;
}

// Pub/Sub push notification data
export interface GmailPubSubMessage {
  emailAddress: string;
  historyId: string;
}

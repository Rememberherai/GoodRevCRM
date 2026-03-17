import { createServiceClient } from '@/lib/supabase/server';
import type { ContractRecipientStatus } from '@/types/contract';

export interface TokenValidationResult {
  valid: boolean;
  error?: string;
  status?: number;
  recipient?: {
    id: string;
    document_id: string;
    project_id: string;
    name: string;
    email: string;
    role: string;
    signing_order: number;
    status: ContractRecipientStatus;
    consent_timestamp: string | null;
    signature_data: Record<string, unknown> | null;
    initials_data: Record<string, unknown> | null;
  };
  document?: {
    id: string;
    project_id: string;
    title: string;
    status: string;
    page_count: number;
    signing_order_type: string;
    current_signing_group: number | null;
    deleted_at: string | null;
    gmail_connection_id: string | null;
    sender_email: string | null;
    owner_id: string | null;
    created_by: string | null;
  };
}

// Signing actions: consent, fields, submit, decline, delegate
const SIGNING_ALLOWED_RECIPIENT_STATUSES: ContractRecipientStatus[] = ['sent', 'viewed'];
const SIGNING_BLOCKED_DOC_STATUSES = ['voided', 'expired', 'completed', 'declined'];

// Download: requires completed, works forever
const DOWNLOAD_ALLOWED_RECIPIENT_STATUSES: ContractRecipientStatus[] = ['signed', 'declined', 'delegated'];

// View metadata/PDF: any non-pending, doc not voided
const VIEW_BLOCKED_DOC_STATUSES = ['voided'];

export type TokenAction = 'sign' | 'download' | 'view';

export async function validateSigningToken(
  token: string,
  action: TokenAction
): Promise<TokenValidationResult> {
  const supabase = createServiceClient();

  // Lookup recipient by token
  const { data: recipient, error: recipientError } = await supabase
    .from('contract_recipients')
    .select('id, document_id, project_id, name, email, role, signing_order, status, consent_timestamp, signature_data, initials_data, token_expires_at')
    .eq('signing_token', token)
    .single();

  if (recipientError || !recipient) {
    return { valid: false, error: 'Invalid signing token', status: 404 };
  }

  // Token expiry check (download tokens work forever)
  if (action !== 'download' && recipient.token_expires_at) {
    if (new Date(recipient.token_expires_at) < new Date()) {
      return { valid: false, error: 'Signing link has expired', status: 410 };
    }
  }

  // Look up document
  const { data: document, error: docError } = await supabase
    .from('contract_documents')
    .select('id, project_id, title, status, page_count, signing_order_type, current_signing_group, deleted_at, gmail_connection_id, sender_email, owner_id, created_by')
    .eq('id', recipient.document_id)
    .single();

  if (docError || !document) {
    return { valid: false, error: 'Document not found', status: 404 };
  }

  // Soft-delete check
  if (document.deleted_at) {
    return { valid: false, error: 'Document is no longer available', status: 410 };
  }

  // Action-specific guards
  if (action === 'sign') {
    if (SIGNING_BLOCKED_DOC_STATUSES.includes(document.status)) {
      return { valid: false, error: `Document is ${document.status}`, status: 403 };
    }
    if (!SIGNING_ALLOWED_RECIPIENT_STATUSES.includes(recipient.status as ContractRecipientStatus)) {
      if (recipient.status === 'signed') {
        return { valid: false, error: 'Already signed', status: 409 };
      }
      return { valid: false, error: `Cannot sign with status: ${recipient.status}`, status: 403 };
    }
    // Sequential guard
    if (document.signing_order_type === 'sequential' && document.current_signing_group !== null) {
      if (recipient.signing_order > document.current_signing_group) {
        return { valid: false, error: 'Not your turn to sign yet', status: 403 };
      }
    }
  } else if (action === 'download') {
    if (document.status !== 'completed') {
      return { valid: false, error: 'Document is not yet completed', status: 403 };
    }
    if (!DOWNLOAD_ALLOWED_RECIPIENT_STATUSES.includes(recipient.status as ContractRecipientStatus)) {
      return { valid: false, error: 'Not authorized to download', status: 403 };
    }
  } else if (action === 'view') {
    if (VIEW_BLOCKED_DOC_STATUSES.includes(document.status)) {
      return { valid: false, error: `Document is ${document.status}`, status: 403 };
    }
    if (recipient.status === 'pending') {
      return { valid: false, error: 'Signing link not yet active', status: 403 };
    }
  }

  return {
    valid: true,
    recipient: {
      id: recipient.id,
      document_id: recipient.document_id,
      project_id: recipient.project_id,
      name: recipient.name,
      email: recipient.email,
      role: recipient.role,
      signing_order: recipient.signing_order,
      status: recipient.status as ContractRecipientStatus,
      consent_timestamp: recipient.consent_timestamp,
      signature_data: recipient.signature_data as Record<string, unknown> | null,
      initials_data: recipient.initials_data as Record<string, unknown> | null,
    },
    document: {
      id: document.id,
      project_id: document.project_id,
      title: document.title,
      status: document.status,
      page_count: document.page_count,
      signing_order_type: document.signing_order_type,
      current_signing_group: document.current_signing_group,
      deleted_at: document.deleted_at,
      gmail_connection_id: document.gmail_connection_id,
      sender_email: document.sender_email,
      owner_id: document.owner_id,
      created_by: document.created_by,
    },
  };
}

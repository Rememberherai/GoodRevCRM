import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { PDFDocument } from 'pdf-lib';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { insertAuditTrail, insertAuditTrailBatch } from './audit';
import { resolveMergeFields } from './merge-fields';
import { sendEmail } from '@/lib/gmail/service';

import type { GmailConnection } from '@/types/gmail';

type ContractDocument = Database['public']['Tables']['contract_documents']['Row'];
type ContractRecipient = Database['public']['Tables']['contract_recipients']['Row'];
type ContractField = Database['public']['Tables']['contract_fields']['Row'];

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*\S+/gi, '');
}

// ─── Upload ──────────────────────────────────────────────────

export async function uploadDocumentPdf(params: {
  supabase: SupabaseClient<Database>;
  userId: string;
  projectId: string | null;
  file: File;
}): Promise<{ filePath: string; fileName: string; fileHash: string; pageCount: number; fileSize: number }> {
  const { supabase, userId, projectId, file } = params;

  if (file.type !== 'application/pdf') {
    throw new Error('Only PDF files are accepted');
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error('File must be under 25MB');
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  let pageCount = 1;
  try {
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    pageCount = pdfDoc.getPageCount();
  } catch {
    throw new Error('Invalid or corrupted PDF file');
  }

  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  const fileId = crypto.randomUUID();
  const pathPrefix = projectId ?? `standalone/${userId}`;
  const storagePath = `${pathPrefix}/documents/${fileId}/${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from('contracts')
    .upload(storagePath, bytes, { contentType: 'application/pdf', upsert: false });

  if (uploadError) {
    throw new Error('Failed to upload file');
  }

  return { filePath: storagePath, fileName: file.name, fileHash: hash, pageCount, fileSize: file.size };
}

// ─── Create ──────────────────────────────────────────────────

export async function createDocument(params: {
  supabase: SupabaseClient<Database>;
  userId: string;
  projectId: string | null;
  title: string;
  description?: string;
  signingOrderType?: 'sequential' | 'parallel';
  filePath: string;
  originalFileName: string;
  originalFileHash?: string;
  pageCount: number;
}): Promise<ContractDocument> {
  const { supabase, userId, projectId } = params;

  const { data: document, error } = await supabase
    .from('contract_documents')
    .insert({
      project_id: projectId,
      created_by: userId,
      owner_id: userId,
      title: params.title,
      description: params.description ?? null,
      signing_order_type: params.signingOrderType ?? 'sequential',
      original_file_path: params.filePath,
      original_file_name: params.originalFileName,
      original_file_hash: params.originalFileHash ?? null,
      page_count: params.pageCount,
    })
    .select()
    .single();

  if (error || !document) {
    throw new Error('Failed to create document');
  }

  insertAuditTrail({
    project_id: projectId,
    document_id: document.id,
    action: 'created',
    actor_type: 'user',
    actor_id: userId,
  });

  return document;
}

// ─── List ────────────────────────────────────────────────────

export async function listDocuments(params: {
  supabase: SupabaseClient<Database>;
  userId: string;
  projectId?: string | null; // undefined = all, null = standalone only, string = specific project
  status?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}): Promise<{ documents: (ContractDocument & { projects: { name: string; slug: string } | null })[]; total: number }> {
  const { supabase, projectId, status, search, page = 1, pageSize = 50 } = params;
  const sortBy = params.sortBy ?? 'created_at';
  const sortOrder = params.sortOrder ?? 'desc';
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from('contract_documents')
    .select('*, projects(name, slug), owner:users!contract_documents_owner_id_fkey(id, full_name, email)', { count: 'exact' })
    .is('deleted_at', null);

  // Source filter
  if (projectId === null) {
    query = query.is('project_id', null);
  } else if (projectId !== undefined) {
    query = query.eq('project_id', projectId);
  }
  // If undefined, return all accessible docs (RLS handles it)

  if (status) {
    query = query.eq('status', status);
  }

  if (search) {
    const sanitized = search.replace(/[%_\\]/g, '\\$&').replace(/"/g, '""');
    query = query.or(`title.ilike."%${sanitized}%",description.ilike."%${sanitized}%"`);
  }

  const ALLOWED_SORT_COLUMNS = ['created_at', 'updated_at', 'title', 'status', 'sent_at', 'completed_at'];
  if (ALLOWED_SORT_COLUMNS.includes(sortBy)) {
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  query = query.range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error('Failed to fetch documents');
  }

  return {
    documents: (data ?? []) as unknown as (ContractDocument & { projects: { name: string; slug: string } | null })[],
    total: count ?? 0,
  };
}

// ─── Get ─────────────────────────────────────────────────────

export async function getDocument(params: {
  supabase: SupabaseClient<Database>;
  documentId: string;
}): Promise<(ContractDocument & { recipients: ContractRecipient[]; fields: ContractField[] }) | null> {
  const { supabase, documentId } = params;

  const { data: document } = await supabase
    .from('contract_documents')
    .select('*, organization:organizations(id, name), person:people(id, first_name, last_name, email), opportunity:opportunities(id, name), owner:users!contract_documents_owner_id_fkey(id, full_name, email), template:contract_templates(id, name), projects(name, slug)')
    .eq('id', documentId)
    .is('deleted_at', null)
    .single();

  if (!document) return null;

  const [{ data: recipients }, { data: fields }] = await Promise.all([
    supabase
      .from('contract_recipients')
      .select('*')
      .eq('document_id', documentId)
      .order('signing_order', { ascending: true }),
    supabase
      .from('contract_fields')
      .select('*')
      .eq('document_id', documentId)
      .order('page_number', { ascending: true }),
  ]);

  return {
    ...document,
    recipients: (recipients ?? []) as ContractRecipient[],
    fields: (fields ?? []) as ContractField[],
  } as ContractDocument & { recipients: ContractRecipient[]; fields: ContractField[] };
}

// ─── Update ──────────────────────────────────────────────────

export async function updateDocument(params: {
  supabase: SupabaseClient<Database>;
  documentId: string;
  updates: Record<string, unknown>;
  currentStatus: string;
}): Promise<ContractDocument> {
  const { supabase, documentId, updates, currentStatus } = params;

  const ALWAYS_EDITABLE = ['send_completed_copy_to_sender', 'send_completed_copy_to_recipients', 'reminder_enabled', 'reminder_interval_days', 'notify_on_view', 'notify_on_sign', 'notify_on_decline'];
  const editableKeys = Object.keys(updates);
  const hasNonSettingsChanges = editableKeys.some((k) => !ALWAYS_EDITABLE.includes(k));

  if (hasNonSettingsChanges && currentStatus !== 'draft') {
    throw new Error('Can only edit draft documents');
  }

  let query = supabase
    .from('contract_documents')
    .update(updates)
    .eq('id', documentId);

  if (hasNonSettingsChanges) {
    query = query.eq('status', 'draft');
  }

  const { data: document, error } = await query.select().single();

  if (error || !document) {
    throw new Error('Failed to update document');
  }

  return document as ContractDocument;
}

// ─── Delete (soft) ───────────────────────────────────────────

export async function deleteDocument(params: {
  supabase: SupabaseClient<Database>;
  documentId: string;
}): Promise<void> {
  const { supabase, documentId } = params;

  const { data, error } = await supabase
    .from('contract_documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', documentId)
    .eq('status', 'draft')
    .is('deleted_at', null)
    .select('id')
    .single();

  if (error || !data) {
    throw new Error('Can only delete draft documents');
  }
}

// ─── Recipients ──────────────────────────────────────────────

export async function addRecipient(params: {
  supabase: SupabaseClient<Database>;
  documentId: string;
  projectId: string | null;
  name: string;
  email: string;
  role?: string;
  signingOrder?: number;
}): Promise<ContractRecipient> {
  const { supabase, documentId, projectId, name, email, role = 'signer', signingOrder = 1 } = params;

  const { data, error } = await supabase
    .from('contract_recipients')
    .insert({
      document_id: documentId,
      project_id: projectId,
      name,
      email,
      role,
      signing_order: signingOrder,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error('Failed to add recipient');
  }

  return data as ContractRecipient;
}

export async function updateRecipient(params: {
  supabase: SupabaseClient<Database>;
  documentId: string;
  recipientId: string;
  updates: { name?: string; email?: string; role?: string; signing_order?: number };
}): Promise<ContractRecipient> {
  const { supabase, documentId, recipientId, updates } = params;

  const { data, error } = await supabase
    .from('contract_recipients')
    .update(updates)
    .eq('id', recipientId)
    .eq('document_id', documentId)
    .select()
    .single();

  if (error || !data) {
    throw new Error('Failed to update recipient');
  }

  return data as ContractRecipient;
}

export async function deleteRecipient(params: {
  supabase: SupabaseClient<Database>;
  recipientId: string;
  documentId: string;
}): Promise<void> {
  const { supabase, recipientId, documentId } = params;

  // Delete associated fields first
  await supabase
    .from('contract_fields')
    .delete()
    .eq('recipient_id', recipientId)
    .eq('document_id', documentId);

  const { error } = await supabase
    .from('contract_recipients')
    .delete()
    .eq('id', recipientId)
    .eq('document_id', documentId);

  if (error) {
    throw new Error('Failed to delete recipient');
  }
}

// ─── Fields ──────────────────────────────────────────────────

export async function saveFields(params: {
  supabase: SupabaseClient<Database>;
  documentId: string;
  projectId: string | null;
  fields: Array<{
    recipient_id: string;
    field_type: string;
    label?: string | null;
    placeholder?: string | null;
    is_required?: boolean;
    page_number: number;
    x: number;
    y: number;
    width: number;
    height: number;
    options?: unknown | null;
    validation_rule?: string | null;
    auto_populate_from?: string | null;
  }>;
}): Promise<ContractField[]> {
  const { supabase, documentId, projectId, fields } = params;

  const recipientIds = [...new Set(fields.map((f) => f.recipient_id))];
  if (recipientIds.length > 0) {
    let recipientsQuery = supabase
      .from('contract_recipients')
      .select('id')
      .eq('document_id', documentId)
      .in('id', recipientIds);

    recipientsQuery = projectId === null
      ? recipientsQuery.is('project_id', null)
      : recipientsQuery.eq('project_id', projectId);

    const { data: validRecipients, error: recipientError } = await recipientsQuery;
    if (recipientError) {
      throw new Error('Failed to validate field recipients');
    }

    const validIds = new Set((validRecipients ?? []).map((r) => r.id));
    const invalidIds = recipientIds.filter((rid) => !validIds.has(rid));
    if (invalidIds.length > 0) {
      throw new Error(`Invalid recipient IDs: ${invalidIds.join(', ')}`);
    }
  }

  // Delete existing fields
  await supabase.from('contract_fields').delete().eq('document_id', documentId);

  if (fields.length === 0) return [];

  const { data, error } = await supabase
    .from('contract_fields')
    .insert(
      fields.map((f) => ({
        document_id: documentId,
        project_id: projectId,
        recipient_id: f.recipient_id,
        field_type: f.field_type,
        label: f.label ?? null,
        placeholder: f.placeholder ?? null,
        is_required: f.is_required ?? true,
        page_number: f.page_number,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        options: (f.options as Database['public']['Tables']['contract_fields']['Insert']['options']) ?? null,
        validation_rule: f.validation_rule ?? null,
        auto_populate_from: f.auto_populate_from ?? null,
      }))
    )
    .select();

  if (error) {
    throw new Error('Failed to save fields');
  }

  return (data ?? []) as ContractField[];
}

// ─── Send ────────────────────────────────────────────────────

export async function sendDocument(params: {
  supabase: SupabaseClient<Database>;
  documentId: string;
  projectId: string | null;
  userId: string;
  gmailConnectionId: string;
  message?: string;
}): Promise<{ sentCount: number; failedCount: number }> {
  const { documentId, projectId, userId, gmailConnectionId, message } = params;
  const serviceClient = createServiceClient();

  // Validate Gmail connection ownership and status.
  const { data: connection } = await serviceClient
    .from('gmail_connections')
    .select('*')
    .eq('id', gmailConnectionId)
    .eq('user_id', userId)
    .single();

  if (!connection || (connection as unknown as GmailConnection).status !== 'connected') {
    throw new Error('Gmail connection is not active');
  }

  const { data: allRecipients } = await serviceClient
    .from('contract_recipients')
    .select('*')
    .eq('document_id', documentId);

  const signers = (allRecipients ?? []).filter((r) => r.role === 'signer');
  const unsupportedRecipients = (allRecipients ?? []).filter((r) => r.role !== 'signer');

  if (signers.length === 0) {
    throw new Error('No signer recipients found');
  }
  if (unsupportedRecipients.length > 0) {
    throw new Error('Only signer recipients are currently supported for contract delivery');
  }

  // Validate each signer has fields
  const { data: allFields } = await serviceClient
    .from('contract_fields')
    .select('recipient_id, field_type, options, auto_populate_from')
    .eq('document_id', documentId);

  for (const r of signers) {
    const rFields = (allFields ?? []).filter((f) => f.recipient_id === r.id);
    if (rFields.length === 0) {
      throw new Error(`Recipient ${r.name} has no fields assigned`);
    }
    if (!rFields.some((f) => f.field_type === 'signature')) {
      throw new Error(`Recipient ${r.name} has no signature field`);
    }
  }

  const invalidDropdowns = (allFields ?? []).filter(
    (f) => f.field_type === 'dropdown'
      && (!f.options || !Array.isArray(f.options) || (f.options as string[]).filter((o) => o.trim()).length === 0)
  );
  if (invalidDropdowns.length > 0) {
    throw new Error('Dropdown fields must have at least one non-empty option before sending');
  }

  const { data: document } = await serviceClient
    .from('contract_documents')
    .select('title, signing_order_type, person_id, organization_id, opportunity_id')
    .eq('id', documentId)
    .single();

  if (!document) {
    throw new Error('Document not found');
  }

  if (document.signing_order_type === 'sequential') {
    const orders = [...new Set(signers.map((r) => r.signing_order))].sort((a, b) => a - b);
    for (let i = 0; i < orders.length; i++) {
      if (orders[i] !== i + 1) {
        throw new Error(`Signing order must be contiguous (1, 2, 3...). Found gap at position ${i + 1}`);
      }
    }
  }

  // Resolve merge fields
  const fieldsToResolve = (allFields ?? []).filter((f) => f.auto_populate_from);
  if (fieldsToResolve.length > 0 && projectId) {
    const keys = fieldsToResolve.map((f) => f.auto_populate_from!).filter(Boolean);
    if (keys.length > 0) {
      const resolved = await resolveMergeFields(keys, {
        projectId,
        personId: document.person_id,
        organizationId: document.organization_id,
        opportunityId: document.opportunity_id,
      });

      // Freeze resolved values
      for (const field of fieldsToResolve) {
        const key = field.auto_populate_from;
        if (key && resolved[key]) {
          await serviceClient
            .from('contract_fields')
            .update({ value: resolved[key], filled_at: new Date().toISOString() })
            .eq('document_id', documentId)
            .eq('auto_populate_from', key)
            .is('value', null);
        }
      }
    }
  }

  // CAS: transition to sent
  const { data: updated, error: updateError } = await serviceClient
    .from('contract_documents')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      gmail_connection_id: gmailConnectionId,
      sender_email: connection.email,
    })
    .eq('id', documentId)
    .eq('status', 'draft')
    .select('id')
    .single();

  if (updateError || !updated) {
    throw new Error('Document has already been sent');
  }

  // Determine first group
  const isSequential = document.signing_order_type === 'sequential';
  const firstGroup = isSequential ? Math.min(...signers.map((r) => r.signing_order)) : null;
  const eligibleRecipients = isSequential
    ? signers.filter((r) => r.signing_order === firstGroup)
    : signers;

  // Update current_signing_group
  if (isSequential && firstGroup !== null) {
    await serviceClient
      .from('contract_documents')
      .update({ current_signing_group: firstGroup })
      .eq('id', documentId);
  }

  let sentCount = 0;
  let failedCount = 0;
  const failedAudits: Parameters<typeof insertAuditTrailBatch>[0] = [];

  for (const recipient of eligibleRecipients) {
    try {
      // CAS: update recipient status
      const { data: sentRecipient } = await serviceClient
        .from('contract_recipients')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', recipient.id)
        .eq('status', 'pending')
        .select('id')
        .single();

      if (!sentRecipient) continue;

      const signingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/sign/${recipient.signing_token}`;
      const messageHtml = message ? `<p>${sanitizeHtml(message)}</p>` : '';

      await sendEmail(
        connection as unknown as GmailConnection,
        {
          to: recipient.email,
          subject: `Please sign: ${document.title ?? 'Document'}`,
          body_html: `
            <div style="font-family: sans-serif; max-width: 600px;">
              <p>Hi ${escHtml(recipient.name)},</p>
              ${messageHtml}
              <p>Please review and sign the document.</p>
              <p style="margin: 24px 0;">
                <a href="${signingUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Review &amp; Sign Document
                </a>
              </p>
            </div>
          `,
        },
        (connection as unknown as GmailConnection).user_id,
        projectId
      );

      sentCount++;
    } catch (err) {
      failedCount++;
      failedAudits.push({
        project_id: projectId,
        document_id: documentId,
        recipient_id: recipient.id,
        action: 'send_failed',
        actor_type: 'system',
        details: { error: err instanceof Error ? err.message : 'Unknown error', email: recipient.email },
      });
    }
  }

  // Audit
  insertAuditTrail({
    project_id: projectId,
    document_id: documentId,
    action: 'sent',
    actor_type: 'user',
    actor_id: userId,
    details: { recipient_count: sentCount, failed_count: failedCount },
  });

  if (failedAudits.length > 0) {
    insertAuditTrailBatch(failedAudits);
  }

  return { sentCount, failedCount };
}

// ─── Void ────────────────────────────────────────────────────

export async function voidDocument(params: {
  supabase: SupabaseClient<Database>;
  documentId: string;
  userId: string;
  reason?: string;
}): Promise<void> {
  const serviceClient = createServiceClient();
  const voidableStatuses = ['sent', 'viewed', 'partially_signed', 'expired', 'declined'];

  const { data, error } = await serviceClient
    .from('contract_documents')
    .update({ status: 'voided', voided_at: new Date().toISOString() })
    .eq('id', params.documentId)
    .in('status', voidableStatuses)
    .select('id, project_id')
    .single();

  if (error || !data) {
    throw new Error('Document cannot be voided');
  }

  insertAuditTrail({
    project_id: data.project_id,
    document_id: params.documentId,
    action: 'voided',
    actor_type: 'user',
    actor_id: params.userId,
    details: params.reason ? { reason: params.reason } : null,
  });
}

// ─── Remind ──────────────────────────────────────────────────

export async function remindRecipients(params: {
  supabase: SupabaseClient<Database>;
  documentId: string;
  projectId: string | null;
  userId: string;
}): Promise<{ sentCount: number }> {
  const { documentId, projectId, userId } = params;
  const serviceClient = createServiceClient();

  const { data: doc } = await serviceClient
    .from('contract_documents')
    .select('title, gmail_connection_id, status')
    .eq('id', documentId)
    .single();

  if (!doc || !['sent', 'viewed', 'partially_signed'].includes(doc.status)) {
    throw new Error('Document is not in a remindable state');
  }

  if (!doc.gmail_connection_id) {
    throw new Error('No Gmail connection for this document');
  }

  const { data: connection } = await serviceClient
    .from('gmail_connections')
    .select('*')
    .eq('id', doc.gmail_connection_id)
    .single();

  if (!connection || (connection as unknown as GmailConnection).status !== 'connected') {
    throw new Error('Gmail connection is not active');
  }

  const { data: recipients } = await serviceClient
    .from('contract_recipients')
    .select('id, name, email, signing_token')
    .eq('document_id', documentId)
    .eq('role', 'signer')
    .in('status', ['sent', 'viewed']);

  let sentCount = 0;
  for (const recipient of recipients ?? []) {
    try {
      await sendEmail(
        connection as unknown as GmailConnection,
        {
          to: recipient.email,
          subject: `Reminder: Please sign "${doc.title}"`,
          body_html: `
            <div style="font-family: sans-serif; max-width: 600px;">
              <p>Hi ${escHtml(recipient.name)},</p>
              <p>This is a reminder that you have a document waiting for your signature: <strong>${escHtml(doc.title)}</strong>.</p>
              <p style="margin: 24px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/sign/${recipient.signing_token}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Review &amp; Sign Document
                </a>
              </p>
            </div>
          `,
        },
        (connection as unknown as GmailConnection).user_id,
        projectId
      );

      insertAuditTrail({
        project_id: projectId,
        document_id: documentId,
        recipient_id: recipient.id,
        action: 'reminder_sent',
        actor_type: 'user',
        actor_id: userId,
      });

      sentCount++;
    } catch (err) {
      insertAuditTrail({
        project_id: projectId,
        document_id: documentId,
        recipient_id: recipient.id,
        action: 'send_failed',
        actor_type: 'system',
        details: { error: err instanceof Error ? err.message : 'Unknown error', type: 'reminder' },
      });
    }
  }

  if (sentCount > 0) {
    await serviceClient
      .from('contract_documents')
      .update({ last_reminder_at: new Date().toISOString() })
      .eq('id', documentId);
  }

  return { sentCount };
}

// ─── Clone ───────────────────────────────────────────────────

export async function cloneDocument(params: {
  supabase: SupabaseClient<Database>;
  documentId: string;
  projectId: string | null;
  userId: string;
}): Promise<ContractDocument> {
  const { documentId, projectId, userId } = params;
  const serviceClient = createServiceClient();

  const { data: original } = await serviceClient
    .from('contract_documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (!original) throw new Error('Document not found');

  // Download and re-upload PDF
  const { data: fileData } = await serviceClient.storage
    .from('contracts')
    .download(original.original_file_path);

  if (!fileData) throw new Error('Failed to download original PDF');

  const bytes = new Uint8Array(await fileData.arrayBuffer());
  const newDocId = crypto.randomUUID();
  const pathPrefix = projectId ?? `standalone/${userId}`;
  const newPath = `${pathPrefix}/documents/${newDocId}/${original.original_file_name}`;

  const { error: uploadError } = await serviceClient.storage
    .from('contracts')
    .upload(newPath, bytes, { contentType: 'application/pdf', upsert: false });

  if (uploadError) throw new Error('Failed to upload cloned PDF');

  const hash = crypto.createHash('sha256').update(bytes).digest('hex');

  // Create new document
  const { data: newDoc, error: insertError } = await serviceClient
    .from('contract_documents')
    .insert({
      id: newDocId,
      project_id: projectId,
      title: `${original.title} (Copy)`,
      description: original.description,
      signing_order_type: original.signing_order_type,
      original_file_path: newPath,
      original_file_name: original.original_file_name,
      original_file_hash: hash,
      page_count: original.page_count,
      template_id: original.template_id,
      reminder_enabled: original.reminder_enabled,
      reminder_interval_days: original.reminder_interval_days,
      notify_on_view: original.notify_on_view,
      notify_on_sign: original.notify_on_sign,
      notify_on_decline: original.notify_on_decline,
      send_completed_copy_to_sender: original.send_completed_copy_to_sender,
      send_completed_copy_to_recipients: original.send_completed_copy_to_recipients,
      created_by: userId,
      owner_id: userId,
    })
    .select()
    .single();

  if (insertError || !newDoc) {
    // Cleanup uploaded file
    await serviceClient.storage.from('contracts').remove([newPath]);
    throw new Error('Failed to create cloned document');
  }

  // Clone recipients
  const { data: originalRecipients } = await serviceClient
    .from('contract_recipients')
    .select('*')
    .eq('document_id', documentId);

  const recipientIdMap = new Map<string, string>();

  for (const r of originalRecipients ?? []) {
    const newRecipientId = crypto.randomUUID();
    recipientIdMap.set(r.id, newRecipientId);

    await serviceClient.from('contract_recipients').insert({
      id: newRecipientId,
      document_id: newDocId,
      project_id: projectId,
      name: r.name,
      email: r.email,
      role: r.role,
      signing_order: r.signing_order,
    });
  }

  // Clone fields
  const { data: originalFields } = await serviceClient
    .from('contract_fields')
    .select('*')
    .eq('document_id', documentId);

  if (originalFields?.length) {
    await serviceClient.from('contract_fields').insert(
      originalFields.map((f) => ({
        document_id: newDocId,
        project_id: projectId,
        recipient_id: recipientIdMap.get(f.recipient_id) ?? f.recipient_id,
        field_type: f.field_type,
        label: f.label,
        placeholder: f.placeholder,
        is_required: f.is_required,
        page_number: f.page_number,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        options: f.options,
        validation_rule: f.validation_rule,
        auto_populate_from: f.auto_populate_from,
      }))
    );
  }

  insertAuditTrail({
    project_id: projectId,
    document_id: newDocId,
    action: 'created',
    actor_type: 'user',
    actor_id: userId,
    details: { cloned_from: documentId },
  });

  return newDoc as ContractDocument;
}

// ─── Audit Trail ─────────────────────────────────────────────

export async function getAuditTrail(params: {
  supabase: SupabaseClient<Database>;
  documentId: string;
}) {
  const { supabase, documentId } = params;

  const { data, error } = await supabase
    .from('contract_audit_trail')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true });

  if (error) throw new Error('Failed to fetch audit trail');

  return data ?? [];
}

// ─── Download ────────────────────────────────────────────────

export async function downloadDocument(params: {
  documentId: string;
  version?: 'original' | 'latest';
}): Promise<{ data: Blob; filename: string }> {
  const { documentId, version = 'latest' } = params;
  const serviceClient = createServiceClient();

  const { data: doc } = await serviceClient
    .from('contract_documents')
    .select('original_file_path, original_file_name, signed_file_path, status')
    .eq('id', documentId)
    .single();

  if (!doc) throw new Error('Document not found');

  let filePath: string;
  let filename: string;

  if (version === 'original' || !doc.signed_file_path) {
    filePath = doc.original_file_path;
    filename = doc.original_file_name;
  } else {
    filePath = doc.signed_file_path;
    filename = `signed_${doc.original_file_name}`;
  }

  if (version === 'latest' && doc.status === 'completed' && !doc.signed_file_path) {
    throw new Error('Document is still being finalized');
  }

  const { data: fileData } = await serviceClient.storage
    .from('contracts')
    .download(filePath);

  if (!fileData) throw new Error('Failed to download file');

  return { data: fileData, filename };
}

// ─── Certificate ─────────────────────────────────────────────

export async function downloadCertificate(params: {
  documentId: string;
}): Promise<{ data: Blob; filename: string }> {
  const serviceClient = createServiceClient();

  const { data: doc } = await serviceClient
    .from('contract_documents')
    .select('certificate_file_path, status')
    .eq('id', params.documentId)
    .single();

  if (!doc || doc.status !== 'completed' || !doc.certificate_file_path) {
    throw new Error('Certificate not available');
  }

  const { data: fileData } = await serviceClient.storage
    .from('contracts')
    .download(doc.certificate_file_path);

  if (!fileData) throw new Error('Failed to download certificate');

  return { data: fileData, filename: 'certificate.pdf' };
}

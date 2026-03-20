import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/gmail/service';
import type { GmailConnection } from '@/types/gmail';
import type { Database, Json } from '@/types/database';

type Supabase = SupabaseClient<Database>;
type ContractTemplateRow = Database['public']['Tables']['contract_templates']['Row'];
type ContractDocumentInsert = Database['public']['Tables']['contract_documents']['Insert'];
type ContractRecipientInsert = Database['public']['Tables']['contract_recipients']['Insert'];
type ContractFieldInsert = Database['public']['Tables']['contract_fields']['Insert'];

export type ContractorDocumentKind =
  | 'scope'
  | 'w9'
  | 'waiver'
  | 'photo_release'
  | 'policy';

interface TemplateRole {
  name?: string;
  order?: number;
}

interface TemplateField {
  field_type?: string;
  role_name?: string;
  label?: string;
  placeholder?: string;
  is_required?: boolean;
  page_number?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  options?: string[];
  validation_rule?: string;
  auto_populate_from?: string;
}

function asRoles(template: ContractTemplateRow): TemplateRole[] {
  return Array.isArray(template.roles) ? (template.roles as TemplateRole[]) : [];
}

function asFields(template: ContractTemplateRow): TemplateField[] {
  return Array.isArray(template.fields) ? (template.fields as TemplateField[]) : [];
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function findConnectedGmail(supabase: Supabase, userId: string) {
  const { data } = await (supabase as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => {
            order: (column: string, options: { ascending: boolean }) => {
              limit: (count: number) => Promise<{ data: GmailConnection[] | null }>;
            };
          };
        };
      };
    };
  })
    .from('gmail_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'connected')
    .order('created_at', { ascending: true })
    .limit(1);

  return data?.[0] ?? null;
}

async function findTemplateForKind(
  supabase: Supabase,
  projectId: string,
  kind: ContractorDocumentKind
) {
  const patterns: Record<ContractorDocumentKind, string> = {
    scope: 'category.ilike.%scope%,name.ilike.%scope%',
    w9: 'category.ilike.%w9%,name.ilike.%w9%,name.ilike.%w-9%',
    waiver: 'category.ilike.%waiver%,name.ilike.%waiver%',
    photo_release: 'category.ilike.%photo%,name.ilike.%photo%,name.ilike.%release%',
    policy: 'category.ilike.%policy%,name.ilike.%policy%,name.ilike.%handbook%',
  };

  const { data } = await supabase
    .from('contract_templates')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .or(patterns[kind])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return data;
}

async function sendContractEmail(params: {
  supabase: Supabase;
  gmailConnection: GmailConnection;
  userId: string;
  projectId: string;
  documentId: string;
  documentTitle: string;
  recipientId: string;
  recipientEmail: string;
  recipientName: string;
  signingToken: string;
}) {
  const signingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/sign/${params.signingToken}`;

  await sendEmail(
    params.gmailConnection,
    {
      to: params.recipientEmail,
      subject: `Please review and sign: ${params.documentTitle}`,
      body_html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2>Document Ready for Signature</h2>
          <p>Hi ${escapeHtml(params.recipientName)},</p>
          <p>${escapeHtml(params.gmailConnection.email)} has sent you a document to review and sign: <strong>${escapeHtml(params.documentTitle)}</strong>.</p>
          <p style="margin: 24px 0;">
            <a href="${signingUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Review &amp; Sign
            </a>
          </p>
        </div>
      `,
    },
    params.userId,
    params.projectId
  );

  await params.supabase
    .from('contract_documents')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      gmail_connection_id: params.gmailConnection.id,
      sender_email: params.gmailConnection.email,
    })
    .eq('id', params.documentId);

  await params.supabase
    .from('contract_recipients')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', params.recipientId);
}

async function createDocumentForTemplate(params: {
  supabase: Supabase;
  adminClient: Supabase;
  projectId: string;
  template: ContractTemplateRow;
  title: string;
  personId: string;
  ownerId: string;
  customFields: Record<string, unknown>;
}) {
  const { data: templateFile, error: downloadError } = await params.adminClient.storage
    .from('contracts')
    .download(params.template.file_path);

  if (downloadError || !templateFile) {
    throw new Error('Failed to read template file');
  }

  const documentId = crypto.randomUUID();
  const fileBytes = new Uint8Array(await templateFile.arrayBuffer());
  const fileHash = crypto.createHash('sha256').update(fileBytes).digest('hex');
  const documentFilePath = `${params.projectId}/documents/${documentId}/${params.template.file_name}`;

  const { error: uploadError } = await params.adminClient.storage
    .from('contracts')
    .upload(documentFilePath, fileBytes, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    throw new Error('Failed to create document file from template');
  }

  const documentInsert: ContractDocumentInsert = {
    id: documentId,
    project_id: params.projectId,
    title: params.title,
    original_file_path: documentFilePath,
    original_file_name: params.template.file_name,
    original_file_hash: fileHash,
    page_count: params.template.page_count,
    template_id: params.template.id,
    person_id: params.personId,
    created_by: params.ownerId,
    owner_id: params.ownerId,
    custom_fields: params.customFields as Json,
  };

  const { data: document, error: documentError } = await params.supabase
    .from('contract_documents')
    .insert(documentInsert)
    .select('*')
    .single();

  if (documentError || !document) {
    await params.adminClient.storage.from('contracts').remove([documentFilePath]).catch(() => undefined);
    throw new Error('Failed to create contract document record');
  }

  return document;
}

async function addRecipientAndFields(params: {
  supabase: Supabase;
  projectId: string;
  documentId: string;
  template: ContractTemplateRow;
  personId: string;
  recipientName: string;
  recipientEmail: string;
}) {
  const roles = asRoles(params.template);
  const signerRole = roles[0]?.name?.trim() || 'Signer';

  const recipientInsert: ContractRecipientInsert = {
    project_id: params.projectId,
    document_id: params.documentId,
    name: params.recipientName,
    email: params.recipientEmail,
    person_id: params.personId,
    role: 'signer',
    signing_order: Math.max(roles[0]?.order ?? 1, 1),
  };

  const { data: recipient, error: recipientError } = await params.supabase
    .from('contract_recipients')
    .insert(recipientInsert)
    .select('*')
    .single();

  if (recipientError || !recipient) {
    throw new Error('Failed to create document signer');
  }

  const fieldInserts: ContractFieldInsert[] = asFields(params.template)
    .filter((field) => !field.role_name || field.role_name === signerRole)
    .map((field) => ({
      project_id: params.projectId,
      document_id: params.documentId,
      recipient_id: recipient.id,
      field_type: field.field_type ?? 'signature',
      label: field.label ?? null,
      placeholder: field.placeholder ?? null,
      is_required: field.is_required ?? true,
      page_number: field.page_number ?? 1,
      x: field.x ?? 50,
      y: field.y ?? 50,
      width: field.width ?? 20,
      height: field.height ?? 6,
      options: (field.options ?? null) as ContractFieldInsert['options'],
      validation_rule: field.validation_rule ?? null,
      auto_populate_from: field.auto_populate_from ?? null,
    }));

  if (fieldInserts.length > 0) {
    const { error: fieldError } = await params.supabase
      .from('contract_fields')
      .insert(fieldInserts);

    if (fieldError) {
      throw new Error('Failed to create contract fields');
    }
  }

  return recipient;
}

export async function sendContractorDocuments(params: {
  supabase: Supabase;
  adminClient: Supabase;
  projectId: string;
  contractorId: string;
  requestedBy: string;
  scopeId?: string | null;
  kinds: ContractorDocumentKind[];
}) {
  const { data: person } = await params.supabase
    .from('people')
    .select('id, first_name, last_name, email')
    .eq('id', params.contractorId)
    .eq('project_id', params.projectId)
    .single();

  if (!person) {
    throw new Error('Contractor record not found');
  }

  const fullName = [person.first_name, person.last_name].filter(Boolean).join(' ').trim() || 'Contractor';
  const gmailConnection = await findConnectedGmail(params.supabase, params.requestedBy);

  const results: Array<{
    kind: ContractorDocumentKind;
    status: 'sent' | 'draft' | 'missing_template' | 'failed';
    document_id?: string;
    message: string;
  }> = [];

  for (const kind of params.kinds) {
    const template = await findTemplateForKind(params.supabase, params.projectId, kind);
    if (!template) {
      results.push({
        kind,
        status: 'missing_template',
        message: `No template found for ${kind.replace(/_/g, ' ')}.`,
      });
      continue;
    }

    try {
      const document = await createDocumentForTemplate({
        supabase: params.supabase,
        adminClient: params.adminClient,
        projectId: params.projectId,
        template,
        title: kind === 'scope' ? `${fullName} Scope of Work` : `${fullName} ${kind.replace(/_/g, ' ')}`,
        personId: person.id,
        ownerId: params.requestedBy,
        customFields: {
          kind: 'contractor_document',
          contractor_id: person.id,
          contractor_scope_id: params.scopeId ?? null,
          document_kind: kind,
        },
      });

      if (!person.email) {
        results.push({
          kind,
          status: 'draft',
          document_id: document.id,
          message: 'Document created as a draft because the contractor has no email address on file.',
        });
        continue;
      }

      const recipient = await addRecipientAndFields({
        supabase: params.supabase,
        projectId: params.projectId,
        documentId: document.id,
        template,
        personId: person.id,
        recipientName: fullName,
        recipientEmail: person.email,
      });

      if (!gmailConnection || !recipient.signing_token) {
        results.push({
          kind,
          status: 'draft',
          document_id: document.id,
          message: 'Document created as a draft because email delivery is not configured.',
        });
        continue;
      }

      await sendContractEmail({
        supabase: params.supabase,
        gmailConnection,
        userId: params.requestedBy,
        projectId: params.projectId,
        documentId: document.id,
        documentTitle: document.title,
        recipientId: recipient.id,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        signingToken: recipient.signing_token,
      });

      results.push({
        kind,
        status: 'sent',
        document_id: document.id,
        message: 'Document sent for signature.',
      });
    } catch (error) {
      results.push({
        kind,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Failed to create contractor document',
      });
    }
  }

  return results;
}

export async function syncContractorScopeFromCompletedDocument(params: {
  supabase: Supabase;
  projectId: string;
  documentId: string;
}) {
  const { data: document } = await params.supabase
    .from('contract_documents')
    .select('id, custom_fields')
    .eq('id', params.documentId)
    .eq('project_id', params.projectId)
    .single();

  const customFields = document?.custom_fields;
  if (!customFields || typeof customFields !== 'object' || Array.isArray(customFields)) return false;

  const kind = (customFields as Record<string, unknown>).kind;
  const scopeId = (customFields as Record<string, unknown>).contractor_scope_id;
  const documentKind = (customFields as Record<string, unknown>).document_kind;

  if (kind !== 'contractor_document' || documentKind !== 'scope' || typeof scopeId !== 'string') {
    return false;
  }

  const { error } = await params.supabase
    .from('contractor_scopes')
    .update({
      status: 'active',
    })
    .eq('id', scopeId)
    .eq('project_id', params.projectId);

  if (error) {
    console.error('[CONTRACTOR_SCOPE_SYNC] Failed to activate contractor scope:', error);
    return false;
  }

  return true;
}

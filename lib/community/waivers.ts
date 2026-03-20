import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/gmail/service';
import type { GmailConnection } from '@/types/gmail';
import type { Database, Json } from '@/types/database';

type Client = SupabaseClient<Database>;
type ContractTemplateRow = Database['public']['Tables']['contract_templates']['Row'];
type ContractDocumentInsert = Database['public']['Tables']['contract_documents']['Insert'];
type ContractRecipientInsert = Database['public']['Tables']['contract_recipients']['Insert'];
type ContractFieldInsert = Database['public']['Tables']['contract_fields']['Insert'];

type TemplateRole = {
  name?: string;
  order?: number;
};

type TemplateField = {
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
};

function escHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function asRecord(value: Json | null | undefined): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseRoles(template: ContractTemplateRow): TemplateRole[] {
  return Array.isArray(template.roles) ? (template.roles as TemplateRole[]) : [];
}

function parseFields(template: ContractTemplateRow): TemplateField[] {
  return Array.isArray(template.fields) ? (template.fields as TemplateField[]) : [];
}

async function findWaiverTemplate(supabase: Client, projectId: string) {
  const { data: exactCategory } = await supabase
    .from('contract_templates')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .eq('category', 'waiver')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (exactCategory) return exactCategory;

  const { data: fuzzyTemplate } = await supabase
    .from('contract_templates')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .or('category.ilike.%waiver%,name.ilike.%waiver%')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return fuzzyTemplate;
}

async function findConnectedGmail(supabase: Client, userId: string) {
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

async function sendWaiverEmail(params: {
  supabase: Client;
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
      subject: `Please sign: ${params.documentTitle}`,
      body_html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2>Waiver Ready for Signature</h2>
          <p>Hi ${escHtml(params.recipientName)},</p>
          <p>${escHtml(params.gmailConnection.email)} has sent you a waiver to review and sign: <strong>${escHtml(params.documentTitle)}</strong></p>
          <p style="margin: 24px 0;">
            <a href="${signingUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Review &amp; Sign Waiver
            </a>
          </p>
          <p style="color: #6b7280; font-size: 14px;">This link is unique to you. Do not share it.</p>
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

export async function createWaiverForEnrollment(params: {
  supabase: Client;
  adminClient: Client;
  projectId: string;
  programId: string;
  programName: string;
  enrollmentId: string;
  personId: string | null;
  createdBy: string;
}) {
  if (!params.personId) {
    return {
      contractId: null as string | null,
      created: false,
      sent: false,
      message: 'Waiver required, but this enrollment is household-only. Collect the waiver manually for the participant.',
    };
  }

  const { data: person } = await params.supabase
    .from('people')
    .select('id, first_name, last_name, email')
    .eq('id', params.personId)
    .single();

  if (!person || !person.email) {
    return {
      contractId: null as string | null,
      created: false,
      sent: false,
      message: 'Waiver required, but the enrollee does not have an email address on file.',
    };
  }

  const template = await findWaiverTemplate(params.supabase, params.projectId);
  if (!template) {
    return {
      contractId: null as string | null,
      created: false,
      sent: false,
      message: 'Enrollment created with pending waiver status. Add a waiver contract template to this project before sending for signature.',
    };
  }

  const { data: templateFile, error: downloadError } = await params.adminClient.storage
    .from('contracts')
    .download(template.file_path);

  if (downloadError || !templateFile) {
    return {
      contractId: null as string | null,
      created: false,
      sent: false,
      message: 'Enrollment created with pending waiver status. The waiver template file could not be read.',
    };
  }

  const documentId = crypto.randomUUID();
  const fileBytes = new Uint8Array(await templateFile.arrayBuffer());
  const fileHash = crypto.createHash('sha256').update(fileBytes).digest('hex');
  const documentFilePath = `${params.projectId}/documents/${documentId}/${template.file_name}`;

  const { error: uploadError } = await params.adminClient.storage
    .from('contracts')
    .upload(documentFilePath, fileBytes, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    return {
      contractId: null as string | null,
      created: false,
      sent: false,
      message: 'Enrollment created with pending waiver status. The waiver document file could not be created.',
    };
  }

  const customFields: Record<string, unknown> = {
    kind: 'program_waiver',
    program_id: params.programId,
    program_enrollment_id: params.enrollmentId,
  };

  const documentInsert: ContractDocumentInsert = {
    id: documentId,
    project_id: params.projectId,
    title: `${params.programName} Waiver`,
    original_file_path: documentFilePath,
    original_file_name: template.file_name,
    original_file_hash: fileHash,
    page_count: template.page_count,
    template_id: template.id,
    person_id: person.id,
    created_by: params.createdBy,
    owner_id: params.createdBy,
    custom_fields: customFields as ContractDocumentInsert['custom_fields'],
  };

  const { data: document, error: documentError } = await params.supabase
    .from('contract_documents')
    .insert(documentInsert)
    .select('*')
    .single();

  if (documentError || !document) {
    await params.adminClient.storage.from('contracts').remove([documentFilePath]).catch(() => undefined);
    return {
      contractId: null as string | null,
      created: false,
      sent: false,
      message: 'Enrollment created with pending waiver status. The waiver document record could not be created.',
    };
  }

  const roles = parseRoles(template);
  const signerRole = roles[0]?.name?.trim() || 'Participant';
  const fullName = [person.first_name, person.last_name].filter(Boolean).join(' ').trim() || 'Participant';

  const recipientInsert: ContractRecipientInsert = {
    project_id: params.projectId,
    document_id: document.id,
    name: fullName,
    email: person.email,
    person_id: person.id,
    role: 'signer',
    signing_order: Math.max(roles[0]?.order ?? 1, 1),
  };

  const { data: recipient, error: recipientError } = await params.supabase
    .from('contract_recipients')
    .insert(recipientInsert)
    .select('*')
    .single();

  if (recipientError || !recipient) {
    return {
      contractId: document.id,
      created: true,
      sent: false,
      message: 'Enrollment created with pending waiver status. The waiver signer could not be added automatically.',
    };
  }

  const templateFields = parseFields(template);
  const signerFields = templateFields.filter((field) => !field.role_name || field.role_name === signerRole);
  const fieldInserts: ContractFieldInsert[] = signerFields.map((field) => ({
    project_id: params.projectId,
    document_id: document.id,
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
    const { error: fieldsError } = await params.supabase
      .from('contract_fields')
      .insert(fieldInserts);

    if (fieldsError) {
      return {
        contractId: document.id,
        created: true,
        sent: false,
        message: 'Enrollment created with pending waiver status. The waiver fields could not be created automatically.',
      };
    }
  }

  const gmailConnection = await findConnectedGmail(params.supabase, params.createdBy);
  if (!gmailConnection) {
    return {
      contractId: document.id,
      created: true,
      sent: false,
      message: 'Enrollment created with pending waiver status. The waiver document was created as a draft because no connected Gmail account was found.',
    };
  }

  if (!recipient.signing_token) {
    return {
      contractId: document.id,
      created: true,
      sent: false,
      message: 'Enrollment created with pending waiver status. The waiver document was created, but no signing token was available for email delivery.',
    };
  }

  try {
    await sendWaiverEmail({
      supabase: params.supabase,
      gmailConnection,
      userId: params.createdBy,
      projectId: params.projectId,
      documentId: document.id,
      documentTitle: document.title,
      recipientId: recipient.id,
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      signingToken: recipient.signing_token,
    });

    return {
      contractId: document.id,
      created: true,
      sent: true,
      message: 'Enrollment created with pending waiver status. The waiver has been emailed for signature.',
    };
  } catch {
    return {
      contractId: document.id,
      created: true,
      sent: false,
      message: 'Enrollment created with pending waiver status. The waiver document was created, but the email send failed.',
    };
  }
}

export async function syncEnrollmentFromCompletedWaiver(params: {
  supabase: Client;
  documentId: string;
  projectId: string;
}) {
  const { data: document } = await params.supabase
    .from('contract_documents')
    .select('id, custom_fields')
    .eq('id', params.documentId)
    .eq('project_id', params.projectId)
    .single();

  const customFields = asRecord(document?.custom_fields);
  if (!customFields || customFields.kind !== 'program_waiver') return false;

  const enrollmentId = customFields.program_enrollment_id;
  if (typeof enrollmentId !== 'string' || !enrollmentId) return false;

  const { data: enrollment } = await params.supabase
    .from('program_enrollments')
    .select('id, status, waiver_status')
    .eq('id', enrollmentId)
    .single();

  if (!enrollment) return false;

  const nextStatus = enrollment.status === 'waitlisted' ? 'active' : enrollment.status;

  await params.supabase
    .from('program_enrollments')
    .update({
      waiver_status: 'signed',
      status: nextStatus,
    })
    .eq('id', enrollmentId);

  return true;
}

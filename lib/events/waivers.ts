import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/gmail/service';
import { getProjectGmailConnection } from '@/lib/events/notifications';
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

async function sendWaiverEmail(params: {
  supabase: Client;
  documentId: string;
  documentTitle: string;
  projectId: string;
  recipientEmail: string;
  recipientId: string;
  recipientName: string;
  signingToken: string;
}) {
  const gmailInfo = await getProjectGmailConnection(params.projectId);
  if (!gmailInfo) {
    return {
      sent: false,
      message: 'Waiver document created as a draft because no connected Gmail account was found.',
    };
  }

  const signingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/sign/${params.signingToken}`;

  await sendEmail(
    gmailInfo.gmailConnection,
    {
      to: params.recipientEmail,
      subject: `Please sign: ${params.documentTitle}`,
      body_html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2>Waiver Ready for Signature</h2>
          <p>Hi ${escHtml(params.recipientName)},</p>
          <p>${escHtml(gmailInfo.gmailConnection.email)} has sent you a waiver to review and sign: <strong>${escHtml(params.documentTitle)}</strong></p>
          <p style="margin: 24px 0;">
            <a href="${signingUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Review &amp; Sign Waiver
            </a>
          </p>
          <p style="color: #6b7280; font-size: 14px;">This link is unique to you. Do not share it.</p>
        </div>
      `,
    },
    gmailInfo.userId,
    params.projectId
  );

  const now = new Date().toISOString();
  await params.supabase
    .from('contract_documents')
    .update({
      status: 'sent',
      sent_at: now,
      gmail_connection_id: gmailInfo.gmailConnection.id,
      sender_email: gmailInfo.gmailConnection.email,
    })
    .eq('id', params.documentId);

  await params.supabase
    .from('contract_recipients')
    .update({
      status: 'sent',
      sent_at: now,
    })
    .eq('id', params.recipientId);

  return {
    sent: true,
    message: 'Waiver emailed for signature.',
  };
}

export async function createWaiverForRegistration(params: {
  supabase: Client;
  adminClient: Client;
  projectId: string;
  eventId: string;
  eventTitle: string;
  registrationId: string;
  personId: string | null;
  registrantName: string;
  registrantEmail: string;
  createdBy: string;
  templateId?: string;
  eventWaiverId?: string;
}) {
  const normalizedEmail = params.registrantEmail.trim().toLowerCase();
  if (!normalizedEmail) {
    return {
      contractId: null as string | null,
      created: false,
      sent: false,
      message: 'Registration is pending waiver, but the registrant does not have an email address.',
    };
  }

  let fullName = params.registrantName.trim() || 'Participant';
  let recipientEmail = normalizedEmail;
  let recipientPersonId: string | null = params.personId;

  if (params.personId) {
    const { data: person } = await params.supabase
      .from('people')
      .select('id, first_name, last_name, email')
      .eq('id', params.personId)
      .single();

    if (person) {
      const personName = [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
      if (personName) fullName = personName;
      if (person.email) recipientEmail = person.email;
      recipientPersonId = person.id;
    }
  }

  let template: ContractTemplateRow | null = null;
  if (params.templateId) {
    const { data } = await params.supabase
      .from('contract_templates')
      .select('*')
      .eq('id', params.templateId)
      .eq('project_id', params.projectId)
      .is('deleted_at', null)
      .single();
    template = data;
  } else {
    const { data } = await params.supabase
      .from('contract_templates')
      .select('*')
      .eq('project_id', params.projectId)
      .eq('category', 'waiver')
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    template = data;
  }

  if (!template) {
    return {
      contractId: null as string | null,
      created: false,
      sent: false,
      message: 'Registration is pending waiver, but no waiver template is configured.',
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
      message: 'Registration is pending waiver, but the waiver template file could not be read.',
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
      message: 'Registration is pending waiver, but the waiver document file could not be created.',
    };
  }

  const customFields: Record<string, unknown> = {
    kind: 'event_waiver',
    event_id: params.eventId,
    event_registration_id: params.registrationId,
    ...(params.eventWaiverId ? { event_waiver_id: params.eventWaiverId } : {}),
    ...(template.html_content ? { html_content: template.html_content } : {}),
  };

  const documentInsert: ContractDocumentInsert = {
    id: documentId,
    project_id: params.projectId,
    title: params.templateId ? `${params.eventTitle} — ${template.name}` : `${params.eventTitle} Waiver`,
    original_file_path: documentFilePath,
    original_file_name: template.file_name,
    original_file_hash: fileHash,
    page_count: template.page_count,
    template_id: template.id,
    person_id: recipientPersonId,
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
      message: 'Registration is pending waiver, but the waiver document record could not be created.',
    };
  }

  const roles = parseRoles(template);
  const signerRole = roles[0]?.name?.trim() || 'Participant';

  const recipientInsert: ContractRecipientInsert = {
    project_id: params.projectId,
    document_id: document.id,
    name: fullName,
    email: recipientEmail,
    person_id: recipientPersonId,
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
      message: 'Waiver document created, but the signer could not be added automatically.',
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
        message: 'Waiver document created, but its signing fields could not be created automatically.',
      };
    }
  }

  if (params.eventWaiverId) {
    await params.supabase
      .from('registration_waivers')
      .upsert({
        registration_id: params.registrationId,
        event_waiver_id: params.eventWaiverId,
        contract_document_id: document.id,
      }, {
        onConflict: 'registration_id,event_waiver_id',
      });
  }

  if (!recipient.signing_token) {
    return {
      contractId: document.id,
      created: true,
      sent: false,
      message: 'Waiver document created, but no signing token was available for email delivery.',
    };
  }

  try {
    const emailResult = await sendWaiverEmail({
      supabase: params.supabase,
      documentId: document.id,
      documentTitle: document.title,
      projectId: params.projectId,
      recipientEmail,
      recipientId: recipient.id,
      recipientName: fullName,
      signingToken: recipient.signing_token,
    });

    return {
      contractId: document.id,
      created: true,
      sent: emailResult.sent,
      message: emailResult.message,
    };
  } catch {
    return {
      contractId: document.id,
      created: true,
      sent: false,
      message: 'Waiver document created, but the email send failed.',
    };
  }
}

export interface RegistrationWaiverResult {
  eventWaiverId: string;
  contractId: string | null;
  created: boolean;
  sent: boolean;
  message: string;
}

export async function createWaiversForRegistration(params: {
  supabase: Client;
  adminClient: Client;
  projectId: string;
  eventId: string;
  eventTitle: string;
  registrationId: string;
  personId: string | null;
  registrantName: string;
  registrantEmail: string;
  createdBy: string;
}): Promise<{ results: RegistrationWaiverResult[]; message: string }> {
  const { data: eventWaivers } = await params.supabase
    .from('event_waivers')
    .select('id, template_id')
    .eq('event_id', params.eventId)
    .order('created_at', { ascending: true });

  if (!eventWaivers || eventWaivers.length === 0) {
    return { results: [], message: 'No waivers configured for this event.' };
  }

  const results: RegistrationWaiverResult[] = [];

  for (const eventWaiver of eventWaivers) {
    const { data: existingRegistrationWaiver } = await params.supabase
      .from('registration_waivers')
      .select('contract_document_id')
      .eq('registration_id', params.registrationId)
      .eq('event_waiver_id', eventWaiver.id)
      .maybeSingle();

    if (existingRegistrationWaiver?.contract_document_id) {
      results.push({
        eventWaiverId: eventWaiver.id,
        contractId: existingRegistrationWaiver.contract_document_id,
        created: false,
        sent: false,
        message: 'Waiver document already exists for this registration.',
      });
      continue;
    }

    const result = await createWaiverForRegistration({
      ...params,
      templateId: eventWaiver.template_id,
      eventWaiverId: eventWaiver.id,
    });

    if (!result.contractId) {
      await params.supabase
        .from('registration_waivers')
        .upsert({
          registration_id: params.registrationId,
          event_waiver_id: eventWaiver.id,
        }, {
          onConflict: 'registration_id,event_waiver_id',
        });
    }

    results.push({
      eventWaiverId: eventWaiver.id,
      contractId: result.contractId,
      created: result.created,
      sent: result.sent,
      message: result.message,
    });
  }

  const sentCount = results.filter((result) => result.sent).length;
  const createdCount = results.filter((result) => result.created).length;
  const total = results.length;

  let message: string;
  if (sentCount === total) {
    message = `Registration created with ${total} waiver(s) sent for signature.`;
  } else if (createdCount > 0) {
    message = `Registration created. ${createdCount}/${total} waiver document(s) created, ${sentCount} sent.`;
  } else {
    message = `Registration created with pending waiver status. ${total} waiver(s) required.`;
  }

  return { results, message };
}

export async function syncRegistrationFromCompletedWaiver(params: {
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
  if (!customFields || customFields.kind !== 'event_waiver') return false;

  const registrationId = customFields.event_registration_id;
  if (typeof registrationId !== 'string' || !registrationId) return false;

  const eventWaiverId = customFields.event_waiver_id;
  const now = new Date().toISOString();

  if (typeof eventWaiverId === 'string' && eventWaiverId) {
    await params.supabase
      .from('registration_waivers')
      .update({
        signed_at: now,
        contract_document_id: params.documentId,
      })
      .eq('registration_id', registrationId)
      .eq('event_waiver_id', eventWaiverId)
      .is('signed_at', null);

    const { count: totalCount } = await params.supabase
      .from('registration_waivers')
      .select('id', { count: 'exact', head: true })
      .eq('registration_id', registrationId);

    const { count: unsignedCount } = await params.supabase
      .from('registration_waivers')
      .select('id', { count: 'exact', head: true })
      .eq('registration_id', registrationId)
      .is('signed_at', null);

    const { data: registration } = await params.supabase
      .from('event_registrations')
      .select('id, status')
      .eq('id', registrationId)
      .single();

    if (!registration) return false;

    if (totalCount && totalCount > 0 && unsignedCount === 0) {
      await params.supabase
        .from('event_registrations')
        .update({
          waiver_status: 'signed',
          waiver_signed_at: now,
          status: registration.status === 'pending_waiver' ? 'confirmed' : registration.status,
        })
        .eq('id', registrationId);
    }

    return true;
  }

  const { data: registration } = await params.supabase
    .from('event_registrations')
    .select('id, status')
    .eq('id', registrationId)
    .single();

  if (!registration) return false;

  await params.supabase
    .from('event_registrations')
    .update({
      waiver_status: 'signed',
      waiver_signed_at: now,
      status: registration.status === 'pending_waiver' ? 'confirmed' : registration.status,
    })
    .eq('id', registrationId);

  return true;
}

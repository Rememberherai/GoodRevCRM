import { z } from 'zod';
import { VALID_MERGE_FIELD_KEYS } from '@/lib/contracts/merge-field-keys';

// Enums
export const contractDocumentStatuses = [
  'draft', 'sent', 'viewed', 'partially_signed',
  'completed', 'declined', 'expired', 'voided',
] as const;

export const contractRecipientStatuses = [
  'pending', 'sent', 'viewed', 'signed', 'declined', 'delegated',
] as const;

export const contractRecipientRoles = ['signer'] as const;

export const contractFieldTypes = [
  'signature', 'initials', 'date_signed', 'text_input',
  'checkbox', 'dropdown', 'name', 'email', 'company', 'title',
] as const;

export const contractSigningOrderTypes = ['sequential', 'parallel'] as const;

export const contractAuditActions = [
  'created', 'sent', 'send_failed', 'viewed', 'field_filled', 'signed',
  'declined', 'voided', 'reminder_sent', 'delegated', 'downloaded',
  'completed', 'expired', 'consent_given', 'link_opened', 'signature_adopted',
] as const;

export const contractAuditActorTypes = ['user', 'signer', 'system'] as const;

// Custom fields
const MAX_CUSTOM_FIELD_KEYS = 50;
const customFieldValueSchema = z.union([
  z.string().max(1000),
  z.number(),
  z.boolean(),
  z.null(),
]);

// Document schemas
export const createContractDocumentSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(500, 'Title must be 500 characters or less'),
  description: z
    .string()
    .max(2000, 'Description must be 2000 characters or less')
    .nullable()
    .optional(),
  original_file_path: z.string().min(1),
  original_file_name: z.string().min(1),
  original_file_hash: z.string().nullable().optional(),
  page_count: z.number().int().min(1).optional(),
  template_id: z.string().uuid().nullable().optional(),
  opportunity_id: z.string().uuid().nullable().optional(),
  organization_id: z.string().uuid().nullable().optional(),
  person_id: z.string().uuid().nullable().optional(),
  signing_order_type: z.enum(contractSigningOrderTypes).optional(),
  expires_at: z.string().datetime().nullable().optional(),
  reminder_enabled: z.boolean().optional(),
  reminder_interval_days: z.number().int().min(1).max(30).nullable().optional(),
  owner_id: z.string().uuid().nullable().optional(),
  custom_fields: z
    .record(z.string(), customFieldValueSchema)
    .refine((obj) => Object.keys(obj).length <= MAX_CUSTOM_FIELD_KEYS, {
      message: `Custom fields cannot exceed ${MAX_CUSTOM_FIELD_KEYS} keys`,
    })
    .optional(),
  send_completed_copy_to_sender: z.boolean().optional(),
  send_completed_copy_to_recipients: z.boolean().optional(),
  notify_on_view: z.boolean().optional(),
  notify_on_sign: z.boolean().optional(),
  notify_on_decline: z.boolean().optional(),
});

export const updateContractDocumentSchema = createContractDocumentSchema
  .omit({ original_file_path: true, original_file_name: true })
  .partial();

export type CreateContractDocumentInput = z.infer<typeof createContractDocumentSchema>;
export type UpdateContractDocumentInput = z.infer<typeof updateContractDocumentSchema>;

// Recipient schemas
export const createContractRecipientSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(200, 'Name must be 200 characters or less'),
  email: z
    .string()
    .email('Must be a valid email')
    .max(320, 'Email must be 320 characters or less'),
  role: z.enum(contractRecipientRoles).optional(),
  signing_order: z.number().int().min(1).optional(),
  person_id: z.string().uuid().nullable().optional(),
});

export const updateContractRecipientSchema = createContractRecipientSchema.partial();

export type CreateContractRecipientInput = z.infer<typeof createContractRecipientSchema>;
export type UpdateContractRecipientInput = z.infer<typeof updateContractRecipientSchema>;

// Field schemas
export const contractFieldSchema = z.object({
  recipient_id: z.string().uuid(),
  field_type: z.enum(contractFieldTypes),
  label: z.string().max(200).nullable().optional(),
  placeholder: z.string().max(200).nullable().optional(),
  is_required: z.boolean().optional(),
  page_number: z.number().int().min(1),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1, 'Width must be at least 1').max(100),
  height: z.number().min(1, 'Height must be at least 1').max(100),
  options: z.array(z.string()).nullable().optional(),
  validation_rule: z.string().max(500).nullable().optional(),
  auto_populate_from: z.string().max(200).refine(
    (val) => VALID_MERGE_FIELD_KEYS.has(val),
    { message: 'Invalid merge field key' }
  ).nullable().optional(),
});

export const bulkFieldsSchema = z.object({
  fields: z.array(contractFieldSchema).max(500),
});

export type ContractFieldInput = z.infer<typeof contractFieldSchema>;
export type BulkFieldsInput = z.infer<typeof bulkFieldsSchema>;

// Send schema
export const sendContractSchema = z.object({
  gmail_connection_id: z.string().uuid('Must be a valid Gmail connection ID'),
  message: z.string().max(5000).optional(),
});

export type SendContractInput = z.infer<typeof sendContractSchema>;

// Signing schemas (public)
export const consentSchema = z.object({
  consent_given: z.literal(true, { message: 'Consent is required' }),
});

export const fieldValueSchema = z.object({
  field_id: z.string().uuid(),
  value: z.string().max(10000),
});

export const saveFieldsSchema = z.object({
  fields: z.array(fieldValueSchema),
});

export const submitSigningSchema = z.object({
  fields: z.array(fieldValueSchema),
  signature_data: z.object({
    type: z.enum(['draw', 'type', 'upload', 'adopt']),
    data: z.string().min(1).max(500_000),
    font: z.string().max(100).optional(),
  }),
  initials_data: z.object({
    type: z.enum(['draw', 'type', 'upload', 'adopt']),
    data: z.string().min(1).max(500_000),
    font: z.string().max(100).optional(),
  }).nullable().optional(),
});

export const declineSchema = z.object({
  reason: z.string().max(1000).optional(),
});

export const delegateSchema = z.object({
  name: z
    .string()
    .min(1, 'Delegate name is required')
    .max(200),
  email: z
    .string()
    .email('Must be a valid email')
    .max(320),
});

export type ConsentInput = z.infer<typeof consentSchema>;
export type SaveFieldsInput = z.infer<typeof saveFieldsSchema>;
export type SubmitSigningInput = z.infer<typeof submitSigningSchema>;
export type DeclineInput = z.infer<typeof declineSchema>;
export type DelegateInput = z.infer<typeof delegateSchema>;

// Template schemas
export const createContractTemplateSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(200, 'Name must be 200 characters or less'),
  description: z.string().max(2000).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  file_path: z.string().min(1),
  file_name: z.string().min(1),
  page_count: z.number().int().min(1).optional(),
  roles: z.array(z.object({
    name: z.string().min(1).max(100),
    order: z.number().int().min(1),
  })).optional(),
  fields: z.array(z.object({
    field_type: z.enum(contractFieldTypes),
    role_name: z.string().min(1),
    label: z.string().max(200).optional(),
    placeholder: z.string().max(200).optional(),
    is_required: z.boolean(),
    page_number: z.number().int().min(1),
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    width: z.number().min(1).max(100),
    height: z.number().min(1).max(100),
    options: z.array(z.string()).optional(),
    validation_rule: z.string().max(500).optional(),
    auto_populate_from: z.string().max(200).refine(
      (val) => VALID_MERGE_FIELD_KEYS.has(val),
      { message: 'Invalid merge field key' }
    ).optional(),
  })).optional(),
  merge_fields: z.array(z.object({
    key: z.string().min(1).max(100),
    label: z.string().min(1).max(200),
    source: z.string().max(200).optional(),
  })).optional(),
});

export const updateContractTemplateSchema = createContractTemplateSchema
  .omit({ file_path: true, file_name: true })
  .partial();

export type CreateContractTemplateInput = z.infer<typeof createContractTemplateSchema>;
export type UpdateContractTemplateInput = z.infer<typeof updateContractTemplateSchema>;

// Void schema
export const voidContractSchema = z.object({
  reason: z.string().max(1000).optional(),
});

export type VoidContractInput = z.infer<typeof voidContractSchema>;

// Waiver from HTML (WYSIWYG editor)
export const createWaiverFromHtmlSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less'),
  description: z.string().max(2000).nullable().optional(),
  html_content: z.string().min(1, 'Waiver content is required').max(100_000),
  include_signature_line: z.boolean().default(true),
  program_id: z.string().uuid().optional(),
  event_id: z.string().uuid().optional(),
});

export type CreateWaiverFromHtmlInput = z.infer<typeof createWaiverFromHtmlSchema>;

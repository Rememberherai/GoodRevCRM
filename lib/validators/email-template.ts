import { z } from 'zod';

// Template categories
export const templateCategories = [
  'outreach',
  'follow_up',
  'introduction',
  'proposal',
  'thank_you',
  'meeting',
  'reminder',
  'newsletter',
  'announcement',
  'other',
] as const;

// Draft statuses
export const draftStatuses = ['draft', 'scheduled', 'sending', 'sent', 'failed'] as const;

// Variable types
export const variableTypes = ['text', 'date', 'number', 'email', 'url'] as const;

// Template variable schema
export const templateVariableSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-z_][a-z0-9_]*$/i),
  label: z.string().min(1).max(100),
  type: z.enum(variableTypes),
  required: z.boolean(),
  default_value: z.string().max(500).optional(),
  description: z.string().max(255).optional(),
});

export type TemplateVariableInput = z.infer<typeof templateVariableSchema>;

// Create template schema
export const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
  subject: z.string().min(1).max(500),
  body_html: z.string().min(1).max(100000),
  body_text: z.string().max(50000).nullable().optional(),
  category: z.enum(templateCategories).optional(),
  variables: z.array(templateVariableSchema).optional(),
  is_active: z.boolean().optional(),
  is_shared: z.boolean().optional(),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

// Update template schema
export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  subject: z.string().min(1).max(500).optional(),
  body_html: z.string().min(1).max(100000).optional(),
  body_text: z.string().max(50000).nullable().optional(),
  category: z.enum(templateCategories).optional(),
  variables: z.array(templateVariableSchema).optional(),
  is_active: z.boolean().optional(),
  is_shared: z.boolean().optional(),
});

export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

// Template query schema
export const templateQuerySchema = z.object({
  category: z.enum(templateCategories).optional(),
  is_active: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  is_shared: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type TemplateQueryInput = z.infer<typeof templateQuerySchema>;

// Render template schema
export const renderTemplateSchema = z.object({
  variables: z.record(z.string(), z.string().or(z.number()).or(z.boolean()).nullable()),
});

export type RenderTemplateInput = z.infer<typeof renderTemplateSchema>;

// Create draft schema
export const createDraftSchema = z.object({
  template_id: z.string().uuid().nullable().optional(),
  person_id: z.string().uuid().nullable().optional(),
  subject: z.string().min(1).max(500),
  body_html: z.string().min(1).max(100000),
  body_text: z.string().max(50000).nullable().optional(),
  to_addresses: z.array(z.string().email()).min(1),
  cc_addresses: z.array(z.string().email()).optional(),
  bcc_addresses: z.array(z.string().email()).optional(),
  reply_to: z.string().email().nullable().optional(),
  scheduled_at: z.string().datetime().nullable().optional(),
});

export type CreateDraftInput = z.infer<typeof createDraftSchema>;

// Update draft schema
export const updateDraftSchema = z.object({
  subject: z.string().min(1).max(500).optional(),
  body_html: z.string().min(1).max(100000).optional(),
  body_text: z.string().max(50000).nullable().optional(),
  to_addresses: z.array(z.string().email()).min(1).optional(),
  cc_addresses: z.array(z.string().email()).optional(),
  bcc_addresses: z.array(z.string().email()).optional(),
  reply_to: z.string().email().nullable().optional(),
  scheduled_at: z.string().datetime().nullable().optional(),
  status: z.enum(['draft', 'scheduled']).optional(),
});

export type UpdateDraftInput = z.infer<typeof updateDraftSchema>;

// Draft query schema
export const draftQuerySchema = z.object({
  status: z.enum(draftStatuses).optional(),
  template_id: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type DraftQueryInput = z.infer<typeof draftQuerySchema>;

// Version query schema
export const versionQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(50).optional().default(10),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type VersionQueryInput = z.infer<typeof versionQuerySchema>;

// Attachment schema
export const createAttachmentSchema = z.object({
  file_name: z.string().min(1).max(255),
  file_type: z.string().min(1).max(100),
  file_size: z.number().min(1).max(10000000), // 10MB max
  file_url: z.string().url(),
});

export type CreateAttachmentInput = z.infer<typeof createAttachmentSchema>;

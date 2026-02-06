import { z } from 'zod';

// Entity types that support import/export
export const importExportEntityTypes = ['person', 'organization', 'opportunity', 'task'] as const;

// Import statuses
export const importStatuses = [
  'pending',
  'validating',
  'processing',
  'completed',
  'failed',
  'cancelled',
] as const;

// Export statuses
export const exportStatuses = [
  'pending',
  'processing',
  'completed',
  'failed',
  'expired',
] as const;

// Export formats
export const exportFormats = ['csv', 'xlsx', 'json'] as const;

// Allowlist of importable columns per entity type
export const importableColumns: Record<(typeof importExportEntityTypes)[number], readonly string[]> = {
  person: ['first_name', 'last_name', 'email', 'phone', 'mobile_phone', 'job_title', 'department', 'linkedin_url', 'notes'],
  organization: ['name', 'domain', 'industry', 'website', 'phone', 'linkedin_url', 'address_street', 'address_city', 'address_state', 'address_postal_code', 'address_country'],
  opportunity: ['name', 'amount', 'stage', 'expected_close_date', 'probability', 'description'],
  task: ['title', 'description', 'status', 'priority', 'due_date'],
};

// Create import job schema
export const createImportJobSchema = z.object({
  entity_type: z.enum(importExportEntityTypes),
  file_name: z.string().min(1).max(255),
  mapping: z.record(z.string().max(100), z.string().max(100)).optional().default({}),
  options: z
    .object({
      skip_duplicates: z.boolean().optional(),
      update_existing: z.boolean().optional(),
      duplicate_key: z.string().max(100).optional(),
      skip_header: z.boolean().optional(),
      delimiter: z.string().max(1).optional(),
    })
    .optional()
    .default({}),
});

export type CreateImportJobInput = z.infer<typeof createImportJobSchema>;

// Update import job schema
export const updateImportJobSchema = z.object({
  status: z.enum(importStatuses).optional(),
  total_rows: z.number().min(0).optional(),
  processed_rows: z.number().min(0).optional(),
  successful_rows: z.number().min(0).optional(),
  failed_rows: z.number().min(0).optional(),
  error_log: z
    .array(
      z.object({
        row: z.number(),
        field: z.string().max(100).optional(),
        message: z.string().max(1000),
        value: z.string().max(1000).optional(),
      })
    )
    .max(1000)
    .optional(),
  mapping: z.record(z.string().max(100), z.string().max(100)).optional(),
});

export type UpdateImportJobInput = z.infer<typeof updateImportJobSchema>;

// Allowlist of exportable/filterable columns per entity type
export const exportableColumns: Record<(typeof importExportEntityTypes)[number], readonly string[]> = {
  person: ['id', 'first_name', 'last_name', 'email', 'phone', 'mobile_phone', 'job_title', 'department', 'linkedin_url', 'notes', 'created_at', 'updated_at'],
  organization: ['id', 'name', 'domain', 'industry', 'website', 'phone', 'linkedin_url', 'address_street', 'address_city', 'address_state', 'address_postal_code', 'address_country', 'created_at', 'updated_at'],
  opportunity: ['id', 'name', 'amount', 'stage', 'expected_close_date', 'probability', 'description', 'created_at', 'updated_at'],
  task: ['id', 'title', 'description', 'status', 'priority', 'due_date', 'created_at', 'updated_at'],
};

// Filter value - constrain to primitive types
const filterValueSchema = z.union([
  z.string().max(500),
  z.number(),
  z.boolean(),
  z.null(),
]);

// Create export job schema
export const createExportJobSchema = z.object({
  entity_type: z.enum(importExportEntityTypes),
  format: z.enum(exportFormats).optional().default('csv'),
  filters: z.record(z.string().max(100), filterValueSchema).optional().default({}),
  columns: z.array(z.string().max(100)).max(50).optional().default([]),
});

export type CreateExportJobInput = z.infer<typeof createExportJobSchema>;

// Update export job schema
export const updateExportJobSchema = z.object({
  status: z.enum(exportStatuses).optional(),
  file_name: z.string().min(1).max(255).optional(),
  file_url: z.string().url().optional(),
  total_rows: z.number().min(0).optional(),
  expires_at: z.string().datetime().optional(),
});

export type UpdateExportJobInput = z.infer<typeof updateExportJobSchema>;

// Import job query schema
export const importJobQuerySchema = z.object({
  entity_type: z.enum(importExportEntityTypes).optional(),
  status: z.enum(importStatuses).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type ImportJobQueryInput = z.infer<typeof importJobQuerySchema>;

// Export job query schema
export const exportJobQuerySchema = z.object({
  entity_type: z.enum(importExportEntityTypes).optional(),
  status: z.enum(exportStatuses).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type ExportJobQueryInput = z.infer<typeof exportJobQuerySchema>;

// CSV row validation schema (generic)
export const csvRowSchema = z.record(z.string(), z.string().or(z.number()).or(z.boolean()).nullable());

// Person import row schema
export const personImportRowSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  mobile_phone: z.string().optional().nullable(),
  job_title: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  linkedin_url: z.string().url().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Organization import row schema
export const organizationImportRowSchema = z.object({
  name: z.string().min(1),
  domain: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  phone: z.string().optional().nullable(),
  linkedin_url: z.string().url().optional().nullable(),
  address_street: z.string().optional().nullable(),
  address_city: z.string().optional().nullable(),
  address_state: z.string().optional().nullable(),
  address_postal_code: z.string().optional().nullable(),
  address_country: z.string().optional().nullable(),
});

// Opportunity import row schema
export const opportunityImportRowSchema = z.object({
  name: z.string().min(1),
  amount: z.coerce.number().optional().nullable(),
  stage: z.string().optional().nullable(),
  expected_close_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  probability: z.coerce.number().min(0).max(100).optional().nullable(),
  description: z.string().optional().nullable(),
});

// Task import row schema
export const taskImportRowSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional().nullable(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().nullable(),
  due_date: z.string().datetime().optional().nullable(),
});

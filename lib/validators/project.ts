import { z } from 'zod';

// Company context schema for AI sequence generation
export const companyContextSchema = z.object({
  name: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  products: z.array(z.string().max(200)).max(20).optional(),
  value_propositions: z.array(z.string().max(500)).max(10).optional(),
});

export type CompanyContext = z.infer<typeof companyContextSchema>;

// Project settings schema — passthrough allows community-specific fields
// (service_area_*, census_*, default_map_center, etc.) to survive validation
export const projectSettingsSchema = z.object({
  company_context: companyContextSchema.optional(),
  customRoles: z.array(z.string().min(1).max(100)).max(50).optional(),
  quotes_enabled: z.boolean().optional(),
}).passthrough();

export type ProjectSettings = z.infer<typeof projectSettingsSchema>;

export const projectTypeSchema = z.enum(['standard', 'community', 'grants']).default('standard');
export const accountingTargetSchema = z.enum(['goodrev', 'quickbooks', 'none']).nullable().optional();
export const frameworkTypeSchema = z.enum(['ccf', 'vital_conditions', 'custom']).nullable().optional();

const projectBaseSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(50, 'Slug must be 50 characters or less')
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Slug must be lowercase letters, numbers, and hyphens only'
    ),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .nullable()
    .optional(),
  logo_url: z
    .string()
    .url('Must be a valid URL')
    .nullable()
    .optional()
    .or(z.literal('')),
  settings: projectSettingsSchema.optional(),
  project_type: projectTypeSchema.optional(),
  accounting_target: accountingTargetSchema,
  framework_type: frameworkTypeSchema,
});

function validateCommunityFields(
  value: z.infer<typeof projectBaseSchema> | Partial<z.infer<typeof projectBaseSchema>>,
  ctx: z.RefinementCtx
) {
  if (value.project_type === 'community') {
    if (!value.framework_type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['framework_type'],
        message: 'Community projects require an impact framework selection',
      });
    }
    if (!value.accounting_target) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['accounting_target'],
        message: 'Community projects require an accounting target selection',
      });
    }
  }
  if (value.project_type === 'grants') {
    if (!value.accounting_target) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['accounting_target'],
        message: 'Grants projects require an accounting target selection',
      });
    }
  }
}

export const projectSchema = projectBaseSchema.superRefine(validateCommunityFields);

export const createProjectSchema = projectSchema;

export const updateProjectSchema = projectBaseSchema.partial().superRefine((value, ctx) => {
  if (!value.project_type) return;
  validateCommunityFields(value, ctx);
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

// Generate slug from name
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

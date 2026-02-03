import { z } from 'zod';

// Company context schema for AI sequence generation
export const companyContextSchema = z.object({
  name: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  products: z.array(z.string().max(200)).max(20).optional(),
  value_propositions: z.array(z.string().max(500)).max(10).optional(),
});

export type CompanyContext = z.infer<typeof companyContextSchema>;

// Project settings schema
export const projectSettingsSchema = z.object({
  company_context: companyContextSchema.optional(),
}).passthrough(); // Allow additional settings

export type ProjectSettings = z.infer<typeof projectSettingsSchema>;

export const projectSchema = z.object({
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
  settings: projectSettingsSchema.optional(),
});

export const createProjectSchema = projectSchema;

export const updateProjectSchema = projectSchema.partial();

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

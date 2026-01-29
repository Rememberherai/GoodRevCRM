import { z } from 'zod';

export const organizationSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(200, 'Name must be 200 characters or less'),
  domain: z
    .string()
    .max(100, 'Domain must be 100 characters or less')
    .nullable()
    .optional(),
  website: z
    .string()
    .url('Must be a valid URL')
    .max(500, 'Website must be 500 characters or less')
    .nullable()
    .optional()
    .or(z.literal('')),
  industry: z
    .string()
    .max(100, 'Industry must be 100 characters or less')
    .nullable()
    .optional(),
  employee_count: z
    .number()
    .int()
    .min(0, 'Employee count must be positive')
    .nullable()
    .optional(),
  annual_revenue: z
    .number()
    .min(0, 'Annual revenue must be positive')
    .nullable()
    .optional(),
  description: z
    .string()
    .max(2000, 'Description must be 2000 characters or less')
    .nullable()
    .optional(),
  logo_url: z
    .string()
    .url('Must be a valid URL')
    .max(500, 'Logo URL must be 500 characters or less')
    .nullable()
    .optional()
    .or(z.literal('')),
  linkedin_url: z
    .string()
    .url('Must be a valid URL')
    .max(500, 'LinkedIn URL must be 500 characters or less')
    .nullable()
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .max(50, 'Phone must be 50 characters or less')
    .nullable()
    .optional(),
  address_street: z
    .string()
    .max(200, 'Street address must be 200 characters or less')
    .nullable()
    .optional(),
  address_city: z
    .string()
    .max(100, 'City must be 100 characters or less')
    .nullable()
    .optional(),
  address_state: z
    .string()
    .max(100, 'State must be 100 characters or less')
    .nullable()
    .optional(),
  address_postal_code: z
    .string()
    .max(20, 'Postal code must be 20 characters or less')
    .nullable()
    .optional(),
  address_country: z
    .string()
    .max(100, 'Country must be 100 characters or less')
    .nullable()
    .optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
});

export const createOrganizationSchema = organizationSchema;
export const updateOrganizationSchema = organizationSchema.partial();

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

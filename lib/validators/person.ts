import { z } from 'zod';

const MAX_CUSTOM_FIELD_KEYS = 50;
const customFieldValueSchema = z.union([
  z.string().max(1000),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const personSchema = z.object({
  first_name: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name must be 100 characters or less'),
  last_name: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must be 100 characters or less'),
  email: z
    .string()
    .email('Must be a valid email')
    .max(255, 'Email must be 255 characters or less')
    .nullable()
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .max(50, 'Phone must be 50 characters or less')
    .nullable()
    .optional(),
  mobile_phone: z
    .string()
    .max(50, 'Mobile phone must be 50 characters or less')
    .nullable()
    .optional(),
  linkedin_url: z
    .string()
    .url('Must be a valid URL')
    .max(500, 'LinkedIn URL must be 500 characters or less')
    .nullable()
    .optional()
    .or(z.literal('')),
  twitter_handle: z
    .string()
    .max(100, 'Twitter handle must be 100 characters or less')
    .nullable()
    .optional(),
  avatar_url: z
    .string()
    .url('Must be a valid URL')
    .max(500, 'Avatar URL must be 500 characters or less')
    .nullable()
    .optional()
    .or(z.literal('')),
  job_title: z
    .string()
    .max(200, 'Job title must be 200 characters or less')
    .nullable()
    .optional(),
  department: z
    .string()
    .max(100, 'Department must be 100 characters or less')
    .nullable()
    .optional(),
  notes: z
    .string()
    .max(2000, 'Notes must be 2000 characters or less')
    .nullable()
    .optional(),
  timezone: z
    .string()
    .max(50, 'Timezone must be 50 characters or less')
    .nullable()
    .optional(),
  preferred_contact_method: z
    .string()
    .max(50, 'Preferred contact method must be 50 characters or less')
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
  custom_fields: z
    .record(z.string(), customFieldValueSchema)
    .refine((obj) => Object.keys(obj).length <= MAX_CUSTOM_FIELD_KEYS, {
      message: `Custom fields cannot exceed ${MAX_CUSTOM_FIELD_KEYS} keys`,
    })
    .optional(),
});

export const createPersonSchema = personSchema;
export const updatePersonSchema = personSchema.partial();

export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;

// Schema for linking a person to an organization
export const personOrganizationSchema = z.object({
  organization_id: z.string().uuid('Must be a valid organization ID'),
  title: z
    .string()
    .max(200, 'Title must be 200 characters or less')
    .nullable()
    .optional(),
  department: z
    .string()
    .max(100, 'Department must be 100 characters or less')
    .nullable()
    .optional(),
  is_primary: z.boolean().optional().default(false),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
});

export type PersonOrganizationInput = z.infer<typeof personOrganizationSchema>;

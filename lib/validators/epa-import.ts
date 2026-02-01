import { z } from 'zod';

// Schema for GET request query params
export const epaImportQuerySchema = z.object({
  state: z
    .string()
    .length(2, 'State must be a 2-letter code')
    .toUpperCase()
    .optional(),
  min_design_flow: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined))
    .refine((val) => val === undefined || !isNaN(val), 'Must be a valid number'),
  max_results: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 250))
    .refine((val) => val >= 1 && val <= 500, 'Must be between 1 and 500'),
  sort_by: z
    .enum(['design_flow', 'name', 'city'])
    .optional()
    .default('design_flow'),
  sort_order: z
    .enum(['asc', 'desc'])
    .optional()
    .default('desc'),
});

// Schema for POST request body - facilities to import
export const epaImportFacilitySchema = z.object({
  permit_id: z.string(),
  name: z.string(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  street: z.string().nullable(),
  county: z.string().nullable(),
  design_flow_mgd: z.number().nullable(),
  actual_flow_mgd: z.number().nullable(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});

export const epaImportCreateSchema = z.object({
  facilities: z
    .array(epaImportFacilitySchema)
    .min(1, 'At least one facility is required')
    .max(500, 'Cannot import more than 500 facilities at once'),
});

// Type exports
export type EPAImportQuery = z.infer<typeof epaImportQuerySchema>;
export type EPAImportFacility = z.infer<typeof epaImportFacilitySchema>;
export type EPAImportCreate = z.infer<typeof epaImportCreateSchema>;

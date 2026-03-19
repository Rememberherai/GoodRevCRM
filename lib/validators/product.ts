import { z } from 'zod';

export const productSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(200, 'Name must be 200 characters or less'),
  description: z
    .string()
    .max(2000, 'Description must be 2000 characters or less')
    .nullable()
    .optional(),
  sku: z
    .string()
    .max(50, 'SKU must be 50 characters or less')
    .nullable()
    .optional(),
  default_price: z
    .number()
    .min(0, 'Price must be positive')
    .max(999999999999, 'Price exceeds maximum value')
    .nullable()
    .optional(),
  unit_type: z
    .string()
    .max(50, 'Unit type must be 50 characters or less')
    .optional(),
  is_active: z.boolean().optional(),
});

export const createProductSchema = productSchema;
export const updateProductSchema = productSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

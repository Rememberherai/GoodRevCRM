import { z } from 'zod';
import { DISPOSITION_COLORS } from '@/types/disposition';

export const serviceTypeSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(50, 'Name must be 50 characters or less'),
  color: z.enum(DISPOSITION_COLORS).optional().default('gray'),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().min(0).optional().default(0),
});

export const createServiceTypeSchema = serviceTypeSchema;
export const updateServiceTypeSchema = serviceTypeSchema.partial();

export type CreateServiceTypeInput = z.infer<typeof createServiceTypeSchema>;
export type UpdateServiceTypeInput = z.infer<typeof updateServiceTypeSchema>;

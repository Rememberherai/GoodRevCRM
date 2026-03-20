import { z } from 'zod';
import { DISPOSITION_COLORS, DISPOSITION_ENTITY_TYPES } from '@/types/disposition';

export const dispositionSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(50, 'Name must be 50 characters or less'),
  color: z.enum(DISPOSITION_COLORS).optional().default('gray'),
  entity_type: z.enum(DISPOSITION_ENTITY_TYPES),
  is_default: z.boolean().optional().default(false),
  sort_order: z.number().int().min(0).optional().default(0),
});

export const createDispositionSchema = dispositionSchema;
export const updateDispositionSchema = dispositionSchema.partial().omit({ entity_type: true });

export type CreateDispositionInput = z.infer<typeof createDispositionSchema>;
export type UpdateDispositionInput = z.infer<typeof updateDispositionSchema>;

import { z } from 'zod';

// Create signature schema
export const createSignatureSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  content_html: z.string().min(1, 'Signature content is required').max(50000, 'Signature content too long'),
  is_default: z.boolean().optional().default(false),
});

export type CreateSignatureInput = z.infer<typeof createSignatureSchema>;

// Update signature schema
export const updateSignatureSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  content_html: z.string().min(1, 'Signature content is required').max(50000, 'Signature content too long').optional(),
  is_default: z.boolean().optional(),
});

export type UpdateSignatureInput = z.infer<typeof updateSignatureSchema>;

import { z } from 'zod';

// Create note schema
export const createNoteSchema = z.object({
  content: z.string().min(1, 'Content is required').max(50000),
  content_html: z.string().max(100000).nullable().optional(),
  person_id: z.string().uuid().nullable().optional(),
  organization_id: z.string().uuid().nullable().optional(),
  opportunity_id: z.string().uuid().nullable().optional(),
  rfp_id: z.string().uuid().nullable().optional(),
  is_pinned: z.boolean().default(false),
}).refine(
  (data) => data.person_id || data.organization_id || data.opportunity_id || data.rfp_id,
  { message: 'At least one entity association is required' }
);

export type CreateNoteInput = z.infer<typeof createNoteSchema>;

// Update note schema
export const updateNoteSchema = z.object({
  content: z.string().min(1).max(50000).optional(),
  content_html: z.string().max(100000).nullable().optional(),
  is_pinned: z.boolean().optional(),
});

export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

// Note query schema
export const noteQuerySchema = z.object({
  person_id: z.string().uuid().optional(),
  organization_id: z.string().uuid().optional(),
  opportunity_id: z.string().uuid().optional(),
  rfp_id: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type NoteQuery = z.infer<typeof noteQuerySchema>;

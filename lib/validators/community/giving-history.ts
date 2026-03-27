import { z } from 'zod';

export const createGivingHistorySchema = z.object({
  grant_name: z.string().min(1, 'Grant name is required').max(300),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  amount: z.number().nonnegative().nullable().optional(),
  program_area: z.string().max(200).nullable().optional(),
  recipient: z.string().max(300).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  sort_order: z.number().int().nonnegative().optional(),
});

export const updateGivingHistorySchema = z.object({
  grant_name: z.string().min(1).max(300).optional(),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  amount: z.number().nonnegative().nullable().optional(),
  program_area: z.string().max(200).nullable().optional(),
  recipient: z.string().max(300).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  sort_order: z.number().int().nonnegative().optional(),
});

export type CreateGivingHistoryInput = z.infer<typeof createGivingHistorySchema>;
export type UpdateGivingHistoryInput = z.infer<typeof updateGivingHistorySchema>;

export interface GivingHistoryEntry {
  id: string;
  organization_id: string;
  grant_name: string;
  year: number | null;
  amount: number | null;
  program_area: string | null;
  recipient: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

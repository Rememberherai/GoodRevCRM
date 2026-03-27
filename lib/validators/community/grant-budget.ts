import { z } from 'zod';

export const BUDGET_CATEGORIES = [
  'personnel',
  'fringe',
  'indirect',
  'supplies',
  'travel',
  'contractual',
  'equipment',
  'other',
] as const;

export type BudgetCategory = typeof BUDGET_CATEGORIES[number];

export const createBudgetLineItemSchema = z.object({
  category: z.enum(BUDGET_CATEGORIES).default('other'),
  description: z.string().min(1, 'Description is required').max(500),
  quantity: z.number().positive().default(1),
  unit_cost: z.number().nonnegative().default(0),
  notes: z.string().max(1000).nullable().optional(),
  sort_order: z.number().int().nonnegative().optional(),
});

export const updateBudgetLineItemSchema = z.object({
  category: z.enum(BUDGET_CATEGORIES).optional(),
  description: z.string().min(1).max(500).optional(),
  quantity: z.number().positive().optional(),
  unit_cost: z.number().nonnegative().optional(),
  notes: z.string().max(1000).nullable().optional(),
  sort_order: z.number().int().nonnegative().optional(),
});

export type CreateBudgetLineItemInput = z.infer<typeof createBudgetLineItemSchema>;
export type UpdateBudgetLineItemInput = z.infer<typeof updateBudgetLineItemSchema>;

export interface BudgetLineItem {
  id: string;
  grant_id: string;
  category: string;
  description: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const BUDGET_CATEGORY_LABELS: Record<BudgetCategory, string> = {
  personnel: 'Personnel',
  fringe: 'Fringe Benefits',
  indirect: 'Indirect Costs',
  supplies: 'Supplies',
  travel: 'Travel',
  contractual: 'Contractual',
  equipment: 'Equipment',
  other: 'Other',
};

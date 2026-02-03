import { z } from 'zod';

// Create task schema
export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).default('pending'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  due_date: z.string().datetime().nullable().optional(),
  person_id: z.string().uuid().nullable().optional(),
  organization_id: z.string().uuid().nullable().optional(),
  opportunity_id: z.string().uuid().nullable().optional(),
  rfp_id: z.string().uuid().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  source_activity_id: z.string().uuid().nullable().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

// Update task schema
export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  due_date: z.string().datetime().nullable().optional(),
  person_id: z.string().uuid().nullable().optional(),
  organization_id: z.string().uuid().nullable().optional(),
  opportunity_id: z.string().uuid().nullable().optional(),
  rfp_id: z.string().uuid().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  source_activity_id: z.string().uuid().nullable().optional(),
});

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

// Task query schema
export const taskQuerySchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigned_to: z.string().uuid().optional(),
  person_id: z.string().uuid().optional(),
  organization_id: z.string().uuid().optional(),
  opportunity_id: z.string().uuid().optional(),
  rfp_id: z.string().uuid().optional(),
  due_before: z.string().datetime().optional(),
  due_after: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type TaskQuery = z.infer<typeof taskQuerySchema>;

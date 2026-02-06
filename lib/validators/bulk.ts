import { z } from 'zod';

// Entity types that support bulk operations
export const bulkEntityTypes = ['person', 'organization', 'opportunity', 'task'] as const;

// Bulk operations
export const bulkOperations = [
  'update',
  'delete',
  'restore',
  'assign',
  'unassign',
  'add_tags',
  'remove_tags',
  'complete',
] as const;

// Base bulk operation schema
export const bulkOperationSchema = z.object({
  entity_type: z.enum(bulkEntityTypes),
  entity_ids: z.array(z.string().uuid()).min(1).max(100),
  operation: z.enum(bulkOperations),
  data: z.record(z.string().max(100), z.union([z.string().max(10000), z.number(), z.boolean(), z.null(), z.undefined()])).optional(),
});

export type BulkOperationInput = z.infer<typeof bulkOperationSchema>;

// Status enums for bulk operations
const personStatuses = ['new', 'contacted', 'qualified', 'unqualified', 'active', 'inactive'] as const;
const organizationStatuses = ['prospect', 'customer', 'partner', 'vendor', 'inactive'] as const;
const opportunityStages = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] as const;

// Bulk update schemas for each entity type
export const bulkPersonUpdateSchema = z.object({
  status: z.enum(personStatuses).optional(),
  owner_id: z.string().uuid().optional(),
});

export const bulkOrganizationUpdateSchema = z.object({
  status: z.enum(organizationStatuses).optional(),
  owner_id: z.string().uuid().optional(),
});

export const bulkOpportunityUpdateSchema = z.object({
  stage: z.enum(opportunityStages).optional(),
  owner_id: z.string().uuid().optional(),
});

export const bulkTaskUpdateSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignee_id: z.string().uuid().optional(),
  due_date: z.string().datetime().optional(),
});

// Tag schemas
export const createTagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .default('#6366f1'),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;

export const updateTagSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

export type UpdateTagInput = z.infer<typeof updateTagSchema>;

export const bulkTagOperationSchema = z.object({
  tag_ids: z.array(z.string().uuid()).min(1).max(10),
  entity_type: z.enum(bulkEntityTypes),
  entity_ids: z.array(z.string().uuid()).min(1).max(100),
});

export type BulkTagOperationInput = z.infer<typeof bulkTagOperationSchema>;

// Query schema for tags
export const tagQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type TagQueryInput = z.infer<typeof tagQuerySchema>;

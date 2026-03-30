import { z } from 'zod';

export const incidentStatusSchema = z.enum(['open', 'under_review', 'resolved', 'closed']);
export const incidentSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const incidentCategorySchema = z.enum(['behavior', 'facility', 'injury', 'safety', 'conflict', 'theft', 'medical', 'other']);
export const incidentVisibilitySchema = z.enum(['private', 'case_management', 'operations']);
export const incidentPersonRoleSchema = z.enum(['subject', 'reporter', 'witness', 'guardian_notified', 'staff_present', 'victim', 'other']);

export const createIncidentSchema = z.object({
  occurred_at: z.string().datetime(),
  summary: z.string().min(1).max(5000),
  details: z.string().max(20000).nullable().optional(),
  severity: incidentSeveritySchema.default('medium'),
  category: incidentCategorySchema.default('other'),
  visibility: incidentVisibilitySchema.default('operations'),
  assigned_to: z.string().uuid().nullable().optional(),
  follow_up_due_at: z.string().datetime().nullable().optional(),
  household_id: z.string().uuid().nullable().optional(),
  event_id: z.string().uuid().nullable().optional(),
  asset_id: z.string().uuid().nullable().optional(),
  location_text: z.string().max(1000).nullable().optional(),
});

export const updateIncidentSchema = z.object({
  assigned_to: z.string().uuid().nullable().optional(),
  status: incidentStatusSchema.optional(),
  severity: incidentSeveritySchema.optional(),
  category: incidentCategorySchema.optional(),
  visibility: incidentVisibilitySchema.optional(),
  summary: z.string().min(1).max(5000).optional(),
  details: z.string().max(20000).nullable().optional(),
  resolution_notes: z.string().max(10000).nullable().optional(),
  follow_up_due_at: z.string().datetime().nullable().optional(),
  household_id: z.string().uuid().nullable().optional(),
  event_id: z.string().uuid().nullable().optional(),
  asset_id: z.string().uuid().nullable().optional(),
  location_text: z.string().max(1000).nullable().optional(),
});

export const incidentPersonSchema = z.object({
  person_id: z.string().uuid(),
  role: incidentPersonRoleSchema.default('other'),
  notes: z.string().max(5000).nullable().optional(),
});

export const incidentListQuerySchema = z.object({
  status: incidentStatusSchema.optional(),
  severity: incidentSeveritySchema.optional(),
  category: incidentCategorySchema.optional(),
  assigned_to: z.string().uuid().optional(),
  unassigned: z.coerce.boolean().optional(),
  household_id: z.string().uuid().optional(),
  event_id: z.string().uuid().optional(),
  asset_id: z.string().uuid().optional(),
  overdue: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

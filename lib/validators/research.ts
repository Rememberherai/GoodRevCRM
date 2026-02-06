import { z } from 'zod';
import type { EntityType } from '@/types/custom-field';

// Valid entity types for research
export const RESEARCH_ENTITY_TYPES: EntityType[] = ['organization', 'person'];

// Schema for starting a research job
export const startResearchSchema = z.object({
  entity_type: z.enum(['organization', 'person'] as const),
  entity_id: z.string().uuid('Invalid entity ID'),
  include_custom_fields: z.boolean().optional(),
});

export type StartResearchInput = z.infer<typeof startResearchSchema>;

// Protected fields that cannot be updated via research apply
const PROTECTED_FIELD_NAMES = ['id', 'project_id', 'created_by', 'created_at', 'updated_at', 'deleted_at'];

// Schema for applying research results
export const applyResearchSchema = z.object({
  job_id: z.string().uuid('Invalid job ID'),
  field_updates: z.array(
    z.object({
      field_name: z.string().min(1, 'Field name is required').refine(
        (name) => !PROTECTED_FIELD_NAMES.includes(name),
        { message: 'Cannot update protected field' }
      ),
      is_custom: z.boolean(),
      value: z.union([z.string().max(10000), z.number(), z.boolean(), z.null()]),
    })
  ).max(50),
});

export type ApplyResearchInput = z.infer<typeof applyResearchSchema>;

// Schema for getting research history
export const researchHistoryQuerySchema = z.object({
  entity_type: z.enum(['organization', 'person', 'opportunity', 'rfp'] as const).optional(),
  entity_id: z.string().uuid().optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed'] as const).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

export type ResearchHistoryQuery = z.infer<typeof researchHistoryQuerySchema>;

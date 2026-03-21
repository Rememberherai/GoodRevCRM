import { z } from 'zod';
import { nullableString, optionalUuidSchema, uuidSchema } from './shared';

export const relationshipTypeSchema = z.enum([
  'neighbor',
  'family',
  'mentor_mentee',
  'friend',
  'caregiver',
  'colleague',
  'service_provider_client',
  'other',
]);

export const relationshipBaseSchema = z.object({
  project_id: optionalUuidSchema,
  person_a_id: uuidSchema,
  person_b_id: uuidSchema,
  type: relationshipTypeSchema,
  notes: nullableString(2000, 'Notes must be 2000 characters or less'),
});

export const relationshipSchema = relationshipBaseSchema.refine((value) => value.person_a_id !== value.person_b_id, {
  message: 'A relationship must connect two distinct people',
  path: ['person_b_id'],
});

export const createRelationshipSchema = relationshipSchema;
export const updateRelationshipSchema = relationshipBaseSchema.partial();

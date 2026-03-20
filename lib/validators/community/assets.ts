import { z } from 'zod';
import {
  nullableString,
  numericCoordinateSchema,
  optionalUuidSchema,
} from './shared';

export const communityAssetCategorySchema = z.enum([
  'facility',
  'land',
  'equipment',
  'vehicle',
  'technology',
  'other',
]);

export const communityAssetConditionSchema = z.enum(['excellent', 'good', 'fair', 'poor']);
export const geocodedStatusSchema = z.enum(['pending', 'success', 'failed', 'manual']);

export const communityAssetSchema = z.object({
  project_id: optionalUuidSchema,
  name: z.string().min(1, 'Asset name is required').max(200, 'Asset name must be 200 characters or less'),
  description: nullableString(5000, 'Description must be 5000 characters or less'),
  category: communityAssetCategorySchema,
  dimension_id: optionalUuidSchema,
  address_street: nullableString(200, 'Street address must be 200 characters or less'),
  address_city: nullableString(100, 'City must be 100 characters or less'),
  address_state: nullableString(100, 'State must be 100 characters or less'),
  address_postal_code: nullableString(20, 'Postal code must be 20 characters or less'),
  address_country: nullableString(100, 'Country must be 100 characters or less'),
  latitude: numericCoordinateSchema.nullable().optional(),
  longitude: numericCoordinateSchema.nullable().optional(),
  geocoded_status: geocodedStatusSchema.default('pending'),
  condition: communityAssetConditionSchema.default('good'),
  value_estimate: z.number().nonnegative().nullable().optional(),
  steward_person_id: optionalUuidSchema,
  steward_organization_id: optionalUuidSchema,
  notes: nullableString(2000, 'Notes must be 2000 characters or less'),
});

export const createCommunityAssetSchema = communityAssetSchema;
export const updateCommunityAssetSchema = communityAssetSchema.partial();

export type CreateCommunityAssetInput = z.infer<typeof createCommunityAssetSchema>;
export type UpdateCommunityAssetInput = z.infer<typeof updateCommunityAssetSchema>;

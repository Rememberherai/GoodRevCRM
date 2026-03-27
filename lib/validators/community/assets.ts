import { z } from 'zod';
import {
  nullableString,
  numericCoordinateSchema,
  optionalUuidSchema,
} from './shared';
import {
  accessModeSchema,
  approvalPolicySchema,
  publicVisibilitySchema,
} from '../asset-access';

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

// Access-related fields for asset creation/update
const assetAccessFieldsSchema = z.object({
  access_mode: accessModeSchema.default('tracked_only'),
  access_enabled: z.boolean().default(false),
  resource_slug: z.string().max(100).nullable().optional(),
  public_name: nullableString(200, 'Public name must be 200 characters or less'),
  public_description: nullableString(5000, 'Public description must be 5000 characters or less'),
  approval_policy: approvalPolicySchema.default('open_auto'),
  public_visibility: publicVisibilitySchema.default('listed'),
  access_instructions: nullableString(5000, 'Access instructions must be 5000 characters or less'),
  booking_owner_user_id: optionalUuidSchema,
  concurrent_capacity: z.number().int().min(1).default(1),
  return_required: z.boolean().default(false),
});

export const createCommunityAssetSchema = communityAssetSchema.merge(assetAccessFieldsSchema.partial());
export const updateCommunityAssetSchema = communityAssetSchema.merge(assetAccessFieldsSchema).partial();

export type CreateCommunityAssetInput = z.infer<typeof createCommunityAssetSchema>;
export type UpdateCommunityAssetInput = z.infer<typeof updateCommunityAssetSchema>;

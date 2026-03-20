import { z } from 'zod';
import {
  dateSchema,
  jsonObjectSchema,
  nullableString,
  numericCoordinateSchema,
  optionalUuidSchema,
  uuidSchema,
} from './shared';

export const householdMemberRelationshipSchema = z.enum([
  'head_of_household',
  'spouse_partner',
  'child',
  'dependent',
  'extended_family',
  'other',
]);

export const geocodedStatusSchema = z.enum(['pending', 'success', 'failed', 'manual']);
export const householdIntakeStatusSchema = z.enum(['draft', 'active', 'closed']);

export const householdMemberSchema = z.object({
  person_id: uuidSchema,
  relationship: householdMemberRelationshipSchema,
  is_primary_contact: z.boolean().default(false),
  start_date: dateSchema,
  end_date: z.string().nullable().optional(),
});

export const householdIntakeSchema = z.object({
  assessed_by: optionalUuidSchema,
  assessed_at: z.string().optional(),
  needs: jsonObjectSchema.default({}),
  notes: nullableString(5000, 'Notes must be 5000 characters or less'),
  status: householdIntakeStatusSchema.default('draft'),
});

export const householdSchema = z.object({
  project_id: optionalUuidSchema,
  name: z.string().min(1, 'Household name is required').max(200, 'Household name must be 200 characters or less'),
  address_street: nullableString(200, 'Street address must be 200 characters or less'),
  address_city: nullableString(100, 'City must be 100 characters or less'),
  address_state: nullableString(100, 'State must be 100 characters or less'),
  address_postal_code: nullableString(20, 'Postal code must be 20 characters or less'),
  address_country: nullableString(100, 'Country must be 100 characters or less'),
  latitude: numericCoordinateSchema.nullable().optional(),
  longitude: numericCoordinateSchema.nullable().optional(),
  geocoded_status: geocodedStatusSchema.default('pending'),
  household_size: z.number().int().min(0).max(1000).nullable().optional(),
  primary_contact_person_id: optionalUuidSchema,
  notes: nullableString(5000, 'Notes must be 5000 characters or less'),
  custom_fields: jsonObjectSchema.default({}),
  members: z.array(householdMemberSchema).max(50, 'A household cannot have more than 50 members').optional(),
  intake: householdIntakeSchema.optional(),
});

export const createHouseholdSchema = householdSchema;
export const updateHouseholdSchema = householdSchema.partial();

export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;
export type UpdateHouseholdInput = z.infer<typeof updateHouseholdSchema>;
export type HouseholdMemberInput = z.infer<typeof householdMemberSchema>;
export type HouseholdIntakeInput = z.infer<typeof householdIntakeSchema>;

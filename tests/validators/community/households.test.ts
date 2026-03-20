import { describe, expect, it } from 'vitest';
import {
  createHouseholdSchema,
  householdIntakeSchema,
  householdMemberSchema,
} from '@/lib/validators/community/households';

describe('Community Household Validators', () => {
  it('accepts a valid household payload with members and intake', () => {
    const result = createHouseholdSchema.safeParse({
      name: 'Martinez Family',
      address_city: 'Denver',
      household_size: 4,
      members: [
        {
          person_id: '550e8400-e29b-41d4-a716-446655440000',
          relationship: 'head_of_household',
          is_primary_contact: true,
          start_date: '2026-03-20',
        },
      ],
      intake: {
        needs: { food_insecurity: true },
        status: 'active',
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects a household without a name', () => {
    const result = createHouseholdSchema.safeParse({
      name: '',
    });

    expect(result.success).toBe(false);
  });

  it('requires a member start date', () => {
    const result = householdMemberSchema.safeParse({
      person_id: '550e8400-e29b-41d4-a716-446655440000',
      relationship: 'child',
    });

    expect(result.success).toBe(false);
  });

  it('accepts intake status values and structured needs data', () => {
    const result = householdIntakeSchema.safeParse({
      status: 'draft',
      needs: { housing: 'unstable', food: true },
    });

    expect(result.success).toBe(true);
  });
});

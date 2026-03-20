import { describe, expect, it } from 'vitest';
import { createContributionSchema } from '@/lib/validators/community/contributions';

describe('Community Contribution Validators', () => {
  it('accepts a monetary contribution with value', () => {
    const result = createContributionSchema.safeParse({
      type: 'monetary',
      dimension_id: '550e8400-e29b-41d4-a716-446655440000',
      value: 500,
      date: '2026-03-20',
    });

    expect(result.success).toBe(true);
  });

  it('requires value for grant and monetary contributions', () => {
    const result = createContributionSchema.safeParse({
      type: 'grant',
      dimension_id: '550e8400-e29b-41d4-a716-446655440000',
      date: '2026-03-20',
    });

    expect(result.success).toBe(false);
  });

  it('requires hours for time-based contributions', () => {
    const result = createContributionSchema.safeParse({
      type: 'volunteer_hours',
      dimension_id: '550e8400-e29b-41d4-a716-446655440000',
      date: '2026-03-20',
    });

    expect(result.success).toBe(false);
  });
});

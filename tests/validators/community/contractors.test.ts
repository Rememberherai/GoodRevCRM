import { describe, expect, it } from 'vitest';
import {
  createContractorScopeSchema,
  createJobSchema,
  createTimeEntrySchema,
} from '@/lib/validators/community/contractors';

describe('Community Contractor Validators', () => {
  it('accepts contractor scopes with structured matching fields', () => {
    const result = createContractorScopeSchema.safeParse({
      title: 'Handyman Scope',
      contractor_id: '550e8400-e29b-41d4-a716-446655440000',
      service_categories: ['repair', 'maintenance'],
      certifications: ['osha-10'],
      status: 'active',
    });

    expect(result.success).toBe(true);
  });

  it('accepts jobs with matching metadata', () => {
    const result = createJobSchema.safeParse({
      title: 'Fix door hinge',
      priority: 'high',
      status: 'assigned',
      required_certifications: ['osha-10'],
      service_category: 'repair',
    });

    expect(result.success).toBe(true);
  });

  it('rejects time entries that end before they start', () => {
    const result = createTimeEntrySchema.safeParse({
      started_at: '2026-03-20T10:00:00Z',
      ended_at: '2026-03-20T09:00:00Z',
    });

    expect(result.success).toBe(false);
  });
});

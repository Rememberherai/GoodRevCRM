import { describe, expect, it } from 'vitest';
import {
  batchAttendanceSchema,
  createProgramSchema,
  programEnrollmentSchema,
} from '@/lib/validators/community/programs';

describe('Community Program Validators', () => {
  it('accepts a valid program payload', () => {
    const result = createProgramSchema.safeParse({
      name: 'ESL Basics',
      status: 'active',
      capacity: 20,
      target_dimensions: ['550e8400-e29b-41d4-a716-446655440000'],
    });

    expect(result.success).toBe(true);
  });

  it('requires either a person or household on enrollment', () => {
    const result = programEnrollmentSchema.safeParse({
      status: 'active',
      waiver_status: 'pending',
    });

    expect(result.success).toBe(false);
  });

  it('accepts batch attendance entries', () => {
    const result = batchAttendanceSchema.safeParse({
      date: '2026-03-20',
      entries: [
        {
          person_id: '550e8400-e29b-41d4-a716-446655440000',
          date: '2026-03-20',
          status: 'present',
          hours: 2,
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});

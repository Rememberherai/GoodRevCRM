import { describe, expect, it } from 'vitest';
import { createGrantSchema } from '@/lib/validators/community/grants';

describe('Community Grant Validators', () => {
  it('accepts a valid grant payload', () => {
    const result = createGrantSchema.safeParse({
      name: 'Community Garden Grant',
      status: 'preparing',
      amount_requested: 15000,
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid grant statuses', () => {
    const result = createGrantSchema.safeParse({
      name: 'Bad Grant',
      status: 'open',
    });

    expect(result.success).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  createShareToken,
  hashPublicDashboardPassword,
  verifyPublicDashboardPassword,
} from '@/lib/community/public-dashboard-auth';

describe('public dashboard auth helpers', () => {
  it('hashes and verifies dashboard passwords', () => {
    const hash = hashPublicDashboardPassword('super-secret');

    expect(verifyPublicDashboardPassword('super-secret', hash)).toBe(true);
    expect(verifyPublicDashboardPassword('wrong-password', hash)).toBe(false);
  });

  it('creates unique share tokens', () => {
    const first = createShareToken();
    const second = createShareToken();

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[a-f0-9]+$/);
  });
});

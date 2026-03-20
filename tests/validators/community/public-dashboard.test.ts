import { describe, expect, it } from 'vitest';
import {
  createDashboardConfigSchema,
  createShareLinkSchema,
  widgetConfigSchema,
} from '@/lib/validators/community/public-dashboard';

describe('Public Dashboard Validators', () => {
  it('appends required excluded categories automatically', () => {
    const result = createDashboardConfigSchema.safeParse({
      title: 'Community Impact',
      slug: 'community-impact',
      widgets: [],
      excluded_categories: ['custom'],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.excluded_categories).toEqual(
        expect.arrayContaining(['custom', 'minors', 'intake', 'risk_scores', 'PII'])
      );
    }
  });

  it('requires a password when access_type is password', () => {
    const result = createDashboardConfigSchema.safeParse({
      title: 'Protected',
      slug: 'protected',
      access_type: 'password',
      widgets: [],
    });

    expect(result.success).toBe(false);
  });

  it('enforces the minimum threshold floor for widgets', () => {
    const result = widgetConfigSchema.safeParse({
      type: 'metric_card',
      min_count_threshold: 2,
    });

    expect(result.success).toBe(false);
  });

  it('accepts share links with optional expiry', () => {
    const result = createShareLinkSchema.safeParse({
      label: 'Board packet',
      expires_at: '2026-04-01T00:00:00Z',
    });

    expect(result.success).toBe(true);
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(...segments: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
}

describe('Public Dashboard Aggregate Query Layer', () => {
  it('uses admin client for aggregate queries (no auth context)', () => {
    const queries = readProjectFile('lib', 'community', 'public-dashboard-queries.ts');

    expect(queries).toContain('createAdminClient');
    expect(queries).not.toContain('createClient');
  });

  it('applies min-count threshold suppression to all groups', () => {
    const queries = readProjectFile('lib', 'community', 'public-dashboard-queries.ts');

    expect(queries).toContain('suppressSmallGroups');
    expect(queries).toContain('minThreshold');
    expect(queries).toContain('Math.max(3');
  });

  it('returns only aggregate data — no individual records', () => {
    const queries = readProjectFile('lib', 'community', 'public-dashboard-queries.ts');

    expect(queries).toContain('metrics');
    expect(queries).toContain('programSummary');
    expect(queries).toContain('contributionSummary');
    expect(queries).toContain('dimensionBreakdown');
    // Should not return raw person data
    expect(queries).not.toContain("from('people')");
  });

  it('queries contributions by type and dimension for breakdowns', () => {
    const queries = readProjectFile('lib', 'community', 'public-dashboard-queries.ts');

    expect(queries).toContain("from('contributions')");
    expect(queries).toContain("from('programs')");
    expect(queries).toContain("from('households')");
    expect(queries).toContain('dimension_id');
  });

  it('serializes aggregate data for snapshot storage', () => {
    const queries = readProjectFile('lib', 'community', 'public-dashboard-queries.ts');

    expect(queries).toContain('serializePublicDashboardPreviewData');
  });
});

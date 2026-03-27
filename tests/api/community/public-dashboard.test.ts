import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(...segments: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
}

describe('Public Dashboard Config API', () => {
  it('has config CRUD routes restricted to owner/admin via public_dashboard manage permission', () => {
    const route = readProjectFile('app', 'api', 'projects', '[slug]', 'public-dashboard', 'route.ts');

    expect(route).toContain("requireCommunityPermission(supabase, user.id, project.id, 'public_dashboard', 'manage')");
    expect(route).toContain("from('public_dashboard_configs')");
    expect(route).toContain('createDashboardConfigSchema.safeParse');
  });

  it('has detail route with PATCH and DELETE', () => {
    const route = readProjectFile('app', 'api', 'projects', '[slug]', 'public-dashboard', '[id]', 'route.ts');

    expect(route).toContain("requireCommunityPermission(supabase, user.id, project.id, 'public_dashboard', 'manage')");
    expect(route).toContain("from('public_dashboard_configs')");
  });

  it('has share link API for creating access tokens', () => {
    const route = readProjectFile('app', 'api', 'projects', '[slug]', 'public-dashboard', '[id]', 'share-links', 'route.ts');

    expect(route).toContain("from('public_dashboard_share_links')");
    expect(route).toContain('token');
  });

  it('supports password-protected dashboards', () => {
    const route = readProjectFile('app', 'api', 'projects', '[slug]', 'public-dashboard', 'route.ts');

    expect(route).toContain('password_hash');
    expect(route).toContain('hashPublicDashboardPassword');
  });

  it('computes snapshot data when data_freshness is snapshot', () => {
    const route = readProjectFile('app', 'api', 'projects', '[slug]', 'public-dashboard', 'route.ts');

    expect(route).toContain("data_freshness === 'snapshot'");
    expect(route).toContain('serializePublicDashboardPreviewData');
    expect(route).toContain('snapshot_data');
  });

  it('does not compute aggregate data for live dashboards on POST', () => {
    const route = readProjectFile('app', 'api', 'projects', '[slug]', 'public-dashboard', 'route.ts');

    // The aggregate call should only happen inside a snapshot guard
    expect(route).toContain("if (validation.data.data_freshness === 'snapshot')");
    expect(route).toContain('getPublicDashboardAggregateData(configForQuery)');
  });

  it('clears snapshot_data when data_freshness switches to live on PATCH', () => {
    const route = readProjectFile('app', 'api', 'projects', '[slug]', 'public-dashboard', '[id]', 'route.ts');

    // When freshness is not snapshot, snapshot_data should be cleared
    expect(route).toContain('snapshot_data = null');
  });

  it('clears archived_at when status transitions away from archived on PATCH', () => {
    const route = readProjectFile('app', 'api', 'projects', '[slug]', 'public-dashboard', '[id]', 'route.ts');

    // Unarchiving should clear the archived_at timestamp
    expect(route).toContain("status !== 'archived' && mergedConfig.archived_at");
    expect(route).toContain('archived_at = null');
  });

  it('preserves published_at on republish (only set if null)', () => {
    const route = readProjectFile('app', 'api', 'projects', '[slug]', 'public-dashboard', '[id]', 'route.ts');

    // published_at should only be set when it's currently null
    expect(route).toContain("status === 'published' && !mergedConfig.published_at");
  });
});

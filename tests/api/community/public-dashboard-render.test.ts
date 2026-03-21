import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(...segments: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
}

function fileExists(...segments: string[]) {
  return fs.existsSync(path.join(process.cwd(), ...segments));
}

describe('Public Dashboard Rendering', () => {
  it('has public rendering route outside authenticated layout', () => {
    expect(fileExists('app', 'public', '[project-slug]', '[dashboard-slug]', 'page.tsx')).toBe(true);

    const page = readProjectFile('app', 'public', '[project-slug]', '[dashboard-slug]', 'page.tsx');

    expect(page).toContain("from('public_dashboard_configs')");
    expect(page).toContain('notFound');
    expect(page).toContain('getPublicDashboardAggregateData');
  });

  it('restricts preview status to admin sessions', () => {
    const page = readProjectFile('app', 'public', '[project-slug]', '[dashboard-slug]', 'page.tsx');

    expect(page).toContain("status === 'preview'");
    expect(page).toContain("['owner', 'admin']");
    expect(page).toContain('getUser');
  });

  it('gates password-protected dashboards with cookie check', () => {
    const page = readProjectFile('app', 'public', '[project-slug]', '[dashboard-slug]', 'page.tsx');

    expect(page).toContain("access_type === 'password'");
    expect(page).toContain('passwordCookie');
    expect(page).toContain('PublicDashboardPasswordGate');
  });

  it('has share link access route', () => {
    expect(fileExists('app', 'public', 'link', '[token]', 'page.tsx')).toBe(true);

    const page = readProjectFile('app', 'public', 'link', '[token]', 'page.tsx');

    expect(page).toContain("from('public_dashboard_share_links')");
    expect(page).toContain('notFound');
    expect(page).toContain('access_count');
  });

  it('uses snapshot data when available instead of live queries', () => {
    const page = readProjectFile('app', 'public', '[project-slug]', '[dashboard-slug]', 'page.tsx');

    expect(page).toContain("data_freshness === 'snapshot'");
    expect(page).toContain('snapshot_data');
    expect(page).toContain('PublicDashboardView');
  });
});

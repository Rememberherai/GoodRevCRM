import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(...segments: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
}

describe('Community Project Phase 7', () => {
  it('adds the community map page, data API, and sidebar navigation', () => {
    const sidebar = readProjectFile('components', 'layout', 'project-sidebar.tsx');
    const mapPage = readProjectFile('app', '(dashboard)', 'projects', '[slug]', 'community-map', 'page.tsx');
    const mapClient = readProjectFile('app', '(dashboard)', 'projects', '[slug]', 'community-map', 'community-map-page-client.tsx');
    const mapRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'community', 'map', 'route.ts');

    expect(sidebar).toContain("{ title: 'Community Map', href: '/community-map', icon: Map }");
    expect(mapPage).toContain('CommunityMapPageClient');
    expect(mapClient).toContain('/api/projects/${slug}/community/map');
    expect(mapRoute).toContain("project.project_type !== 'community'");
    expect(mapRoute).toContain("from('households')");
    expect(mapRoute).toContain("from('community_assets')");
    expect(mapRoute).toContain("from('programs')");
    expect(mapRoute).toContain("from('organizations')");
  });

  it('adds geocoding service, queue, and API trigger', () => {
    const geocoding = readProjectFile('lib', 'community', 'geocoding.ts');
    const queue = readProjectFile('lib', 'community', 'geocoding-queue.ts');
    const geocodeRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'community', 'geocode', 'route.ts');
    const householdRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'households', 'route.ts');
    const assetRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'community-assets', 'route.ts');

    expect(geocoding).toContain('nominatim.openstreetmap.org/search');
    expect(queue).toContain('processGeocodeTargets');
    expect(queue).toContain("table: 'households'");
    expect(queue).toContain("table: 'community_assets'");
    expect(geocodeRoute).toContain('processPendingCommunityGeocodes');
    expect(householdRoute).toContain("return 'pending';");
    expect(assetRoute).toContain("return 'pending';");
  });

  it('adds the dashboard V2 mini-map and population impact widgets', () => {
    const dashboardClient = readProjectFile('components', 'community', 'dashboard', 'community-dashboard-client.tsx');
    const dashboardLib = readProjectFile('lib', 'community', 'dashboard.ts');
    const miniMap = readProjectFile('components', 'community', 'dashboard', 'mini-map.tsx');
    const populationImpact = readProjectFile('components', 'community', 'dashboard', 'population-impact.tsx');

    expect(dashboardClient).toContain('<PopulationImpact');
    expect(dashboardClient).toContain('<MiniMap');
    expect(dashboardLib).toContain('community_population_denominator');
    expect(dashboardLib).toContain('miniMap');
    expect(miniMap).toContain('Community Coverage');
    expect(populationImpact).toContain('Population Impact');
  });
});

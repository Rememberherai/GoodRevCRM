import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(...segments: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
}

describe('Community Facility Booking API', () => {
  it('has asset-scoped bookings route with GET and POST', () => {
    const route = readProjectFile('app', 'api', 'projects', '[slug]', 'community-assets', '[id]', 'bookings', 'route.ts');

    expect(route).toContain("requireCommunityPermission(supabase, user.id, project.id, 'community_assets', 'view')");
    expect(route).toContain("requireCommunityPermission(supabase, user.id, project.id, 'community_assets', 'update')");
    expect(route).toContain("from('event_types')");
    expect(route).toContain("from('bookings')");
    expect(route).toContain("asset_id");
  });

  it('implements conflict detection for overlapping bookings', () => {
    const route = readProjectFile('app', 'api', 'projects', '[slug]', 'community-assets', '[id]', 'bookings', 'route.ts');

    expect(route).toContain('overlappingBookings');
    expect(route).toContain("'Booking conflicts with an existing reservation'");
    expect(route).toContain('409');
  });

  it('auto-creates event type when no event_type_id is provided', () => {
    const route = readProjectFile('app', 'api', 'projects', '[slug]', 'community-assets', '[id]', 'bookings', 'route.ts');

    expect(route).toContain("insert({");
    expect(route).toContain("asset_id: id");
    expect(route).toContain("location_type: 'in_person'");
  });

  it('has asset calendar view component', () => {
    const calendar = readProjectFile('components', 'community', 'assets', 'asset-calendar.tsx');

    expect(calendar).toContain('bookings');
  });
});

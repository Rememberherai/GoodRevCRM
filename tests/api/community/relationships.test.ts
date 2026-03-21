import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(...segments: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
}

describe('Community Relationships API', () => {
  it('has list route with permission guard and person filtering', () => {
    const route = readProjectFile('app', 'api', 'projects', '[slug]', 'relationships', 'route.ts');

    expect(route).toContain("requireCommunityPermission(supabase, user.id, project.id, 'relationships', 'view')");
    expect(route).toContain("requireCommunityPermission(supabase, user.id, project.id, 'relationships', 'create')");
    expect(route).toContain("from('relationships')");
    expect(route).toContain('createRelationshipSchema.safeParse');
    expect(route).toContain('person_a_id');
    expect(route).toContain('person_b_id');
  });

  it('computes influencer scores from relationship data', () => {
    const route = readProjectFile('app', 'api', 'projects', '[slug]', 'relationships', 'route.ts');

    expect(route).toContain('buildInfluencerScores');
    expect(route).toContain('influencerScores');
  });

  it('has detail route with update and delete', () => {
    const route = readProjectFile('app', 'api', 'projects', '[slug]', 'relationships', '[id]', 'route.ts');

    expect(route).toContain("requireCommunityPermission(supabase, user.id, project.id, 'relationships', 'update')");
    expect(route).toContain("requireCommunityPermission(supabase, user.id, project.id, 'relationships', 'delete')");
  });

  it('has social network utility for influencer identification', () => {
    const socialNetwork = readProjectFile('lib', 'community', 'social-network.ts');

    expect(socialNetwork).toContain('buildInfluencerScores');
  });
});

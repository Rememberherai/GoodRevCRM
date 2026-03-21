import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(...segments: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
}

describe('Community Broadcasts API', () => {
  it('has list and create routes with permission guards', () => {
    const route = readProjectFile('app', 'api', 'projects', '[slug]', 'broadcasts', 'route.ts');

    expect(route).toContain("requireCommunityPermission(supabase, user.id, project.id, 'broadcasts', 'view')");
    expect(route).toContain("requireCommunityPermission(supabase, user.id, project.id, 'broadcasts', 'create')");
    expect(route).toContain("from('broadcasts')");
    expect(route).toContain('createBroadcastSchema.safeParse');
    expect(route).toContain('emitAutomationEvent');
  });

  it('resolves broadcast recipients from filter criteria', () => {
    const route = readProjectFile('app', 'api', 'projects', '[slug]', 'broadcasts', 'route.ts');

    expect(route).toContain('resolveBroadcastRecipients');
    expect(route).toContain('filter_criteria');
    expect(route).toContain('recipient_count');
  });

  it('has send route for delivering broadcasts', () => {
    const sendRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'broadcasts', '[id]', 'send', 'route.ts');

    expect(sendRoute).toContain("from('broadcasts')");
    expect(sendRoute).toContain('emitAutomationEvent');
  });

  it('has detail route with update and delete', () => {
    const route = readProjectFile('app', 'api', 'projects', '[slug]', 'broadcasts', '[id]', 'route.ts');

    expect(route).toContain("requireCommunityPermission(supabase, user.id, project.id, 'broadcasts', 'view')");
    expect(route).toContain("requireCommunityPermission(supabase, user.id, project.id, 'broadcasts', 'update')");
  });
});

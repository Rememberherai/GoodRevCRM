import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(...segments: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
}

describe('Community Referrals API', () => {
  it('has list route with community permission guard and status filtering', () => {
    const route = readProjectFile('app', 'api', 'projects', '[slug]', 'referrals', 'route.ts');

    expect(route).toContain("requireCommunityPermission(supabase, user.id, project.id, 'referrals', 'view')");
    expect(route).toContain("requireCommunityPermission(supabase, user.id, project.id, 'referrals', 'create')");
    expect(route).toContain("from('referrals')");
    expect(route).toContain('createReferralSchema.safeParse');
    expect(route).toContain('emitAutomationEvent');
    expect(route).toContain("status");
    expect(route).toContain("household_id");
  });

  it('has detail route with PATCH and DELETE', () => {
    const route = readProjectFile('app', 'api', 'projects', '[slug]', 'referrals', '[id]', 'route.ts');

    expect(route).toContain("requireCommunityPermission(supabase, user.id, project.id, 'referrals', 'view')");
    expect(route).toContain("requireCommunityPermission(supabase, user.id, project.id, 'referrals', 'update')");
    expect(route).toContain("requireCommunityPermission(supabase, user.id, project.id, 'referrals', 'delete')");
  });

  it('links referrals to partner organizations and people', () => {
    const route = readProjectFile('app', 'api', 'projects', '[slug]', 'referrals', 'route.ts');

    expect(route).toContain('partner:organizations');
    expect(route).toContain('person:people');
    expect(route).toContain('household:households');
  });

  it('has referral overdue time-trigger in automation types', () => {
    const types = readProjectFile('types', 'automation.ts');
    const validators = readProjectFile('lib', 'validators', 'automation.ts');
    const timeTriggers = readProjectFile('lib', 'automations', 'time-triggers.ts');

    expect(types).toContain("'referral.overdue'");
    expect(validators).toContain("'referral.overdue'");
    expect(timeTriggers).toContain('findOverdueReferrals');
  });
});

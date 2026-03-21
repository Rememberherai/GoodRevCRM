import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { triggerTypeGroups } from '@/types/automation';
import { triggerTypes } from '@/lib/validators/automation';

function readProjectFile(...segments: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
}

describe('community automation events', () => {
  it('adds first-class community trigger types to automation metadata', () => {
    const communityTriggers = triggerTypeGroups.community.triggers.map((trigger) => trigger.type);

    expect(communityTriggers).toContain('household.created');
    expect(communityTriggers).toContain('program.enrollment.created');
    expect(communityTriggers).toContain('job.assigned');
    expect(communityTriggers).toContain('referral.completed');
    expect(communityTriggers).toContain('broadcast.sent');
    expect(triggerTypes).toContain('risk_score.high');
    expect(triggerTypes).toContain('contractor.onboarded');
  });

  it('emits community-specific triggers from the built API routes', () => {
    const householdsRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'households', 'route.ts');
    const membersRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'households', '[id]', 'members', 'route.ts');
    const contributionsRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'contributions', 'route.ts');
    const enrollmentsRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'programs', '[id]', 'enrollments', 'route.ts');
    const attendanceRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'programs', '[id]', 'attendance', 'route.ts');
    const scopesRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'contractor-scopes', 'route.ts');
    const jobsRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'jobs', 'route.ts');
    const acceptRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'jobs', '[id]', 'accept', 'route.ts');
    const declineRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'jobs', '[id]', 'decline', 'route.ts');
    const completeRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'jobs', '[id]', 'complete', 'route.ts');
    const referralsRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'referrals', 'route.ts');
    const referralDetailRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'referrals', '[id]', 'route.ts');
    const broadcastSendRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'broadcasts', '[id]', 'send', 'route.ts');
    const riskIndexRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'community', 'risk-index', 'route.ts');

    expect(householdsRoute).toContain("triggerType: 'household.created'");
    expect(membersRoute).toContain("triggerType: 'household.member_added'");
    expect(contributionsRoute).toContain("triggerType: 'contribution.created'");
    expect(enrollmentsRoute).toContain("triggerType: 'program.enrollment.created'");
    expect(attendanceRoute).toContain("triggerType: 'program.attendance.batch'");
    expect(scopesRoute).toContain("triggerType: 'contractor.onboarded'");
    expect(jobsRoute).toContain("triggerType: 'job.assigned'");
    expect(acceptRoute).toContain("triggerType: 'job.accepted'");
    expect(declineRoute).toContain("triggerType: 'job.declined'");
    expect(completeRoute).toContain("triggerType: 'job.completed'");
    expect(referralsRoute).toContain("triggerType: 'referral.created'");
    expect(referralDetailRoute).toContain("triggerType: data.status === 'completed' ? ('referral.completed'");
    expect(broadcastSendRoute).toContain("triggerType: 'broadcast.sent'");
    expect(riskIndexRoute).toContain("triggerType: 'risk_score.high'");
  });
});

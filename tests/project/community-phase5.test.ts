import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(...segments: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
}

describe('Community Project Phase 5', () => {
  it('adds contractor scope APIs and document completion sync', () => {
    const scopesRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'contractor-scopes', 'route.ts');
    const scopeDetailRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'contractor-scopes', '[id]', 'route.ts');
    const contractorDocuments = readProjectFile('lib', 'community', 'contractor-documents.ts');
    const signSubmitRoute = readProjectFile('app', 'api', 'sign', '[token]', 'submit', 'route.ts');

    expect(scopesRoute).toContain("from('contractor_scopes')");
    expect(scopeDetailRoute).toContain("entityType: 'contractor_scope'");
    expect(contractorDocuments).toContain('sendContractorDocuments');
    expect(contractorDocuments).toContain('syncContractorScopeFromCompletedDocument');
    expect(signSubmitRoute).toContain('syncContractorScopeFromCompletedDocument');
  });

  it('adds job action APIs and time entry tracking', () => {
    const jobsRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'jobs', 'route.ts');
    const jobDetailRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'jobs', '[id]', 'route.ts');
    const acceptRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'jobs', '[id]', 'accept', 'route.ts');
    const declineRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'jobs', '[id]', 'decline', 'route.ts');
    const completeRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'jobs', '[id]', 'complete', 'route.ts');
    const pullRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'jobs', '[id]', 'pull', 'route.ts');
    const timeEntriesRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'jobs', '[id]', 'time-entries', 'route.ts');

    expect(jobsRoute).toContain('checkContractorScopeMatch');
    expect(jobDetailRoute).toContain("Contractors can only update job status and notes from this route");
    expect(acceptRoute).toContain("status: 'accepted'");
    expect(acceptRoute).toContain("Your contractor account is not linked to a person record yet.");
    expect(declineRoute).toContain("status: 'declined'");
    expect(completeRoute).toContain("status: 'completed'");
    expect(pullRoute).toContain("status: 'pulled'");
    expect(timeEntriesRoute).toContain("from('job_time_entries')");
    expect(timeEntriesRoute).toContain('computeTimeEntryDurationMinutes');
  });

  it('adds jobs and contractors pages plus the contractor portal', () => {
    const sidebar = readProjectFile('components', 'layout', 'project-sidebar.tsx');
    const projectLayout = readProjectFile('app', '(dashboard)', 'projects', '[slug]', 'layout.tsx');
    const jobsPage = readProjectFile('app', '(dashboard)', 'projects', '[slug]', 'jobs', 'jobs-page-client.tsx');
    const jobDetail = readProjectFile('app', '(dashboard)', 'projects', '[slug]', 'jobs', '[id]', 'job-detail-client.tsx');
    const contractorsPage = readProjectFile('app', '(dashboard)', 'projects', '[slug]', 'contractors', 'contractors-page-client.tsx');
    const contractorDetail = readProjectFile('app', '(dashboard)', 'projects', '[slug]', 'contractors', '[id]', 'contractor-detail-client.tsx');
    const portalLayout = readProjectFile('app', '(dashboard)', 'contractor', '[slug]', 'layout.tsx');
    const portalPage = readProjectFile('app', '(dashboard)', 'contractor', '[slug]', 'contractor-portal-page-client.tsx');
    const profilePage = readProjectFile('app', '(dashboard)', 'contractor', '[slug]', 'profile', 'page.tsx');
    const tracker = readProjectFile('components', 'community', 'jobs', 'time-tracker.tsx');

    expect(sidebar).toContain("{ title: 'Contractors', href: '/contractors', icon: HardHat }");
    expect(sidebar).toContain("{ title: 'Jobs', href: '/jobs', icon: BriefcaseBusiness }");
    expect(projectLayout).toContain("redirect(`/contractor/${slug}`)");
    expect(jobsPage).toContain('Create Job');
    expect(jobDetail).toContain('<TimeTracker');
    expect(contractorsPage).toContain('Contractor Directory');
    expect(contractorDetail).toContain('Scope of Work');
    expect(portalLayout).toContain('ContractorPortalHeader');
    expect(portalPage).toContain('Available Jobs');
    expect(profilePage).toContain('Connect Google Calendar');
    expect(tracker).toContain('Pause for Break');
    expect(tracker).toContain('Complete Job');
  });

  it('links contractor invitation acceptance to the matching person record', () => {
    const acceptInvitationRoute = readProjectFile('app', 'api', 'invitations', 'accept', 'route.ts');

    expect(acceptInvitationRoute).toContain("if (invitation?.role === 'contractor' && invitation.project_id)");
    expect(acceptInvitationRoute).toContain("update({");
    expect(acceptInvitationRoute).toContain('is_contractor: true');
    expect(acceptInvitationRoute).toContain("eq('email', invitation.email)");
  });

  it('exposes contractor-safe community chat tools and filters by role', () => {
    const communityTools = readProjectFile('lib', 'chat', 'community-tool-registry.ts');
    const chatRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'chat', 'route.ts');
    const chatSettings = readProjectFile('components', 'chat', 'chat-settings.tsx');
    const chatPrompt = readProjectFile('lib', 'chat', 'system-prompt.ts');
    const useChat = readProjectFile('hooks', 'use-chat.ts');

    expect(communityTools).toContain("name: 'contractors.create_scope'");
    expect(communityTools).toContain("name: 'contractors.send_documents'");
    expect(communityTools).toContain("name: 'contractors.onboard'");
    expect(communityTools).toContain("name: 'jobs.assign'");
    expect(communityTools).toContain("name: 'jobs.my_jobs'");
    expect(communityTools).toContain('roles?: ProjectRole[];');
    expect(communityTools).toContain('getAllowedTools');
    expect(chatRoute).toContain("['board_viewer', 'member', 'viewer'].includes(membership.role)");
    expect(chatSettings).toContain("ToolGroup name=\"Contractors\"");
    expect(chatSettings).toContain("ToolGroup name=\"Jobs\"");
    expect(chatPrompt).toContain('Contractor Onboarding');
    expect(chatPrompt).toContain('Contractor users can only access their own work context');
    expect(useChat).toContain('contractors.create_scope');
    expect(useChat).toContain('jobs.assign');
  });
});

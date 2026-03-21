import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(...segments: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
}

function fileExists(...segments: string[]) {
  return fs.existsSync(path.join(process.cwd(), ...segments));
}

describe('Community Project Phase 6 — Grant Management', () => {
  it('has grants CRUD API routes with proper guards and automation events', () => {
    const listRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'grants', 'route.ts');
    const detailRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'grants', '[id]', 'route.ts');

    // List route
    expect(listRoute).toContain("requireCommunityPermission(supabase, user.id, project.id, 'grants', 'view')");
    expect(listRoute).toContain("requireCommunityPermission(supabase, user.id, project.id, 'grants', 'create')");
    expect(listRoute).toContain('createGrantSchema.safeParse');
    expect(listRoute).toContain('emitAutomationEvent');
    expect(listRoute).toContain("from('grants')");

    // Detail route — GET, PATCH, DELETE
    expect(detailRoute).toContain("requireCommunityPermission(supabase, user.id, project.id, 'grants', 'view')");
    expect(detailRoute).toContain("requireCommunityPermission(supabase, user.id, project.id, 'grants', 'update')");
    expect(detailRoute).toContain("requireCommunityPermission(supabase, user.id, project.id, 'grants', 'delete')");
    expect(detailRoute).toContain('updateGrantSchema.safeParse');

    // Status change detection and contribution auto-creation
    expect(detailRoute).toContain("grant.status_changed");
    expect(detailRoute).toContain("status === 'awarded'");
    expect(detailRoute).toContain("type: 'grant'");
    expect(detailRoute).toContain("grant_id: data.id");
  });

  it('has grant outreach API route using notes for outreach tracking', () => {
    const outreachRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'grants', '[id]', 'outreach', 'route.ts');

    expect(outreachRoute).toContain("from('notes')");
    expect(outreachRoute).toContain('[grant:');
    expect(outreachRoute).toContain("requireCommunityPermission(supabase, user.id, project.id, 'grants', 'view')");
    expect(outreachRoute).toContain("requireCommunityPermission(supabase, user.id, project.id, 'grants', 'update')");
  });

  it('has grant compliance reporting API', () => {
    const complianceRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'community', 'reports', 'grant-compliance', 'route.ts');

    expect(complianceRoute).toContain("requireCommunityPermission(supabase, user.id, project.id, 'grants', 'view')");
    expect(complianceRoute).toContain("from('grants')");
    expect(complianceRoute).toContain("from('contributions')");
    expect(complianceRoute).toContain("from('program_enrollments')");
    expect(complianceRoute).toContain("from('program_attendance')");
    expect(complianceRoute).toContain('unduplicated_participants');
    expect(complianceRoute).toContain('total_hours_delivered');
    expect(complianceRoute).toContain('budget_utilization_pct');
  });

  it('has grant pipeline UI pages (server + client)', () => {
    expect(fileExists('app', '(dashboard)', 'projects', '[slug]', 'grants', 'page.tsx')).toBe(true);
    expect(fileExists('app', '(dashboard)', 'projects', '[slug]', 'grants', 'grants-page-client.tsx')).toBe(true);

    const clientPage = readProjectFile('app', '(dashboard)', 'projects', '[slug]', 'grants', 'grants-page-client.tsx');
    expect(clientPage).toContain('KanbanView');
    expect(clientPage).toContain('ListView');
    expect(clientPage).toContain("NewGrantDialog");
    expect(clientPage).toContain('handleStatusChange');
    expect(clientPage).toContain("'researching'");
    expect(clientPage).toContain("'awarded'");
    expect(clientPage).toContain("'declined'");
  });

  it('has grant detail page with tabs (Info, Outreach, Compliance, Deadlines)', () => {
    expect(fileExists('app', '(dashboard)', 'projects', '[slug]', 'grants', '[id]', 'page.tsx')).toBe(true);
    expect(fileExists('app', '(dashboard)', 'projects', '[slug]', 'grants', '[id]', 'grant-detail-client.tsx')).toBe(true);

    const detailClient = readProjectFile('app', '(dashboard)', 'projects', '[slug]', 'grants', '[id]', 'grant-detail-client.tsx');
    expect(detailClient).toContain('TabsTrigger value="info"');
    expect(detailClient).toContain('TabsTrigger value="outreach"');
    expect(detailClient).toContain('TabsTrigger value="compliance"');
    expect(detailClient).toContain('TabsTrigger value="deadlines"');
    expect(detailClient).toContain('GrantComplianceCard');
  });

  it('has new grant dialog and compliance report components', () => {
    expect(fileExists('components', 'community', 'grants', 'new-grant-dialog.tsx')).toBe(true);
    expect(fileExists('components', 'community', 'reports', 'grant-compliance.tsx')).toBe(true);
    expect(fileExists('components', 'community', 'grants', 'upcoming-deadlines.tsx')).toBe(true);

    const compliance = readProjectFile('components', 'community', 'reports', 'grant-compliance.tsx');
    expect(compliance).toContain('budget_utilization_pct');
    expect(compliance).toContain('unduplicated_participants');
    expect(compliance).toContain('remaining_budget');
  });

  it('adds Grants to the community sidebar', () => {
    const sidebar = readProjectFile('components', 'layout', 'project-sidebar.tsx');
    expect(sidebar).toContain("title: 'Grants'");
    expect(sidebar).toContain("href: '/grants'");
    expect(sidebar).toContain('Award');
  });

  it('registers grant automation triggers and entity type', () => {
    const automationTypes = readProjectFile('types', 'automation.ts');
    const automationValidator = readProjectFile('lib', 'validators', 'automation.ts');
    const actionsMap = readProjectFile('lib', 'automations', 'actions.ts');
    const timeTriggersMap = readProjectFile('lib', 'automations', 'time-triggers.ts');

    expect(automationTypes).toContain("| 'grant.created'");
    expect(automationTypes).toContain("| 'grant.status_changed'");
    expect(automationTypes).toContain("| 'grant.deadline_approaching'");
    expect(automationTypes).toContain("| 'grant'");

    expect(automationValidator).toContain("'grant.created'");
    expect(automationValidator).toContain("'grant.status_changed'");
    expect(automationValidator).toContain("'grant'");

    expect(actionsMap).toContain("grant: 'grants'");
    expect(timeTriggersMap).toContain("grant: 'grants'");
  });

  it('registers grant chat tools and MCP tools', () => {
    const registry = readProjectFile('lib', 'chat', 'community-tool-registry.ts');
    const systemPrompt = readProjectFile('lib', 'chat', 'system-prompt.ts');
    const chatSettings = readProjectFile('components', 'chat', 'chat-settings.tsx');
    const chatColors = readProjectFile('components', 'chat', 'chat-message-list.tsx');
    const useChat = readProjectFile('hooks', 'use-chat.ts');
    const mcpCommunity = readProjectFile('lib', 'mcp', 'tools', 'community.ts');

    // Chat tools
    expect(registry).toContain("name: 'grants.list'");
    expect(registry).toContain("name: 'grants.get'");
    expect(registry).toContain("name: 'grants.create'");
    expect(registry).toContain("name: 'grants.update'");
    expect(registry).toContain("name: 'grants.draft_narrative'");
    expect(registry).toContain("name: 'grants.draft_budget'");
    expect(registry).toContain("name: 'calendar.sync_grant'");

    // System prompt mentions grants
    expect(systemPrompt).toContain('Grants');

    // Chat settings UI
    expect(chatSettings).toContain('ToolGroup name="Grants"');

    // Chat message colors
    expect(chatColors).toContain('grants:');

    // MUTATING_TOOLS
    expect(useChat).toContain("'grants.create'");
    expect(useChat).toContain("'grants.update'");

    // MCP tools include grants
    expect(mcpCommunity).toContain("'grants'");
  });

  it('has calendar sync support for grant deadlines', () => {
    const calendarBridge = readProjectFile('lib', 'assistant', 'calendar-bridge.ts');
    expect(calendarBridge).toContain('syncGrantDeadline');
    expect(calendarBridge).toContain("'loi'");
    expect(calendarBridge).toContain("'application'");
    expect(calendarBridge).toContain("'report'");
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(...segments: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
}

describe('Community Project Phase 9', () => {
  it('adds community MCP modules and project-type-aware server registration', () => {
    const server = readProjectFile('lib', 'mcp', 'server.ts');
    const communityTools = readProjectFile('lib', 'mcp', 'tools', 'community.ts');
    const contractorTools = readProjectFile('lib', 'mcp', 'tools', 'contractors.ts');
    const auth = readProjectFile('lib', 'mcp', 'auth.ts');
    const types = readProjectFile('types', 'mcp.ts');

    expect(server).toContain("context.projectType === 'community'");
    expect(server).toContain('registerCommunityTools');
    expect(server).toContain('registerCommunityContractorTools');
    expect(communityTools).toContain('households');
    expect(communityTools).toContain('broadcasts');
    expect(contractorTools).toContain('jobs');
    expect(contractorTools).toContain('receipts');
    expect(auth).toContain("select('project_type')");
    expect(types).toContain('COMMUNITY_MCP_ROLES');
    expect(types).toContain('projectType: ProjectType');
  });

  it('expands the community chat registry and UI metadata', () => {
    const registry = readProjectFile('lib', 'chat', 'community-tool-registry.ts');
    const prompt = readProjectFile('lib', 'chat', 'system-prompt.ts');
    const settings = readProjectFile('components', 'chat', 'chat-settings.tsx');
    const useChat = readProjectFile('hooks', 'use-chat.ts');

    expect(registry).toContain("name: 'households.list'");
    expect(registry).toContain("name: 'programs.enroll'");
    expect(registry).toContain("name: 'contributions.create'");
    expect(registry).toContain("name: 'assets.update'");
    expect(registry).toContain("name: 'referrals.update'");
    expect(registry).toContain("name: 'broadcasts.send'");
    expect(prompt).toContain('Community Assets');
    expect(prompt).toContain('Referrals / Relationships / Broadcasts');
    expect(settings).toContain('ToolGroup name="Assets"');
    expect(settings).toContain('ToolGroup name="Broadcasts"');
    expect(useChat).toContain('households.create');
    expect(useChat).toContain('broadcasts.send');
  });

  it('registers first-class community automation events', () => {
    const automationTypes = readProjectFile('types', 'automation.ts');
    const automationValidator = readProjectFile('lib', 'validators', 'automation.ts');
    const riskRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'community', 'risk-index', 'route.ts');

    expect(automationTypes).toContain("| 'household.created'");
    expect(automationTypes).toContain("| 'job.completed'");
    expect(automationTypes).toContain("| 'broadcast.sent'");
    expect(automationTypes).toContain("| 'referral'");
    expect(automationTypes).toContain("| 'relationship'");
    expect(automationValidator).toContain("'risk_score.high'");
    expect(riskRoute).toContain("triggerType: 'risk_score.high'");
  });
});

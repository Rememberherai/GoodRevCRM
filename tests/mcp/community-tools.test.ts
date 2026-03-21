import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { registerCommunityTools } from '@/lib/mcp/tools/community';
import { registerCommunityContractorTools } from '@/lib/mcp/tools/contractors';
import type { McpContext } from '@/types/mcp';

function readProjectFile(...segments: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
}

class FakeServer {
  toolNames: string[] = [];

  tool(name: string) {
    this.toolNames.push(name);
  }
}

function makeContext(role: McpContext['role']): McpContext {
  return {
    projectId: 'project-1',
    projectType: 'community',
    userId: 'user-1',
    role,
    apiKeyId: 'key-1',
    supabase: {} as McpContext['supabase'],
  };
}

describe('community MCP tools', () => {
  it('registers core community tools for staff contexts', () => {
    const server = new FakeServer();
    registerCommunityTools(server as never, () => makeContext('staff'));

    expect(server.toolNames).toContain('households.list');
    expect(server.toolNames).toContain('programs.enroll');
    expect(server.toolNames).toContain('contributions.create');
    expect(server.toolNames).toContain('assets.update');
    expect(server.toolNames).toContain('referrals.update');
    expect(server.toolNames).toContain('broadcasts.send');
  });

  it('registers only contractor-safe tools for contractor contexts', () => {
    const server = new FakeServer();
    registerCommunityContractorTools(server as never, () => makeContext('contractor'));

    expect(server.toolNames).toContain('jobs.my_jobs');
    expect(server.toolNames).toContain('jobs.my_calendar');
    expect(server.toolNames).toContain('jobs.work_plan');
    expect(server.toolNames).not.toContain('households.list');
    expect(server.toolNames).not.toContain('broadcasts.send');
  });

  it('wires the MCP server and key route for community projects', () => {
    const serverFile = readProjectFile('lib', 'mcp', 'server.ts');
    const keysRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'mcp', 'keys', 'route.ts');
    const authFile = readProjectFile('lib', 'mcp', 'auth.ts');

    expect(serverFile).toContain("context.projectType === 'community'");
    expect(serverFile).toContain('registerCommunityTools');
    expect(serverFile).toContain('registerCommunityContractorTools');
    expect(keysRoute).toContain('createCommunityKeySchema');
    expect(keysRoute).toContain('COMMUNITY_MCP_ROLES');
    expect(authFile).toContain("select('project_type')");
    expect(authFile).toContain('projectType: project.project_type');
  });
});

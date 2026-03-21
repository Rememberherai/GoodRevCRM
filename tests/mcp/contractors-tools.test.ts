import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
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

describe('MCP Contractors Tools', () => {
  it('registers contractor-scoped tools for contractor role', () => {
    const server = new FakeServer();
    registerCommunityContractorTools(server as never, () => makeContext('contractor'));

    expect(server.toolNames).toContain('jobs.my_jobs');
    expect(server.toolNames).toContain('jobs.my_calendar');
    expect(server.toolNames).toContain('jobs.work_plan');
    // Contractor should NOT see household/program/broadcast tools
    expect(server.toolNames).not.toContain('households.list');
    expect(server.toolNames).not.toContain('programs.list');
    expect(server.toolNames).not.toContain('broadcasts.send');
  });

  it('registers all contractor tools for staff role', () => {
    const server = new FakeServer();
    registerCommunityContractorTools(server as never, () => makeContext('staff'));

    expect(server.toolNames).toContain('jobs.assign');
    expect(server.toolNames).toContain('contractors.create_scope');
    expect(server.toolNames).toContain('contractors.send_documents');
  });

  it('has contractor tools registered in MCP server', () => {
    const serverFile = readProjectFile('lib', 'mcp', 'server.ts');

    expect(serverFile).toContain('registerCommunityContractorTools');
  });

  it('filters contractor tools by CONTRACTOR_PREFIXES', () => {
    const contractorsFile = readProjectFile('lib', 'mcp', 'tools', 'contractors.ts');

    expect(contractorsFile).toContain('CONTRACTOR_PREFIXES');
    expect(contractorsFile).toContain("'contractors'");
    expect(contractorsFile).toContain("'jobs'");
    expect(contractorsFile).toContain("'calendar'");
    expect(contractorsFile).toContain("'receipts'");
  });
});

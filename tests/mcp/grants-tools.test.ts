import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(...segments: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
}

describe('MCP Grants Tools', () => {
  it('exposes grants tools via community tool registry with grants prefix', () => {
    const registry = readProjectFile('lib', 'chat', 'community-tool-registry.ts');

    expect(registry).toContain("name: 'grants.list'");
    expect(registry).toContain("name: 'grants.get'");
    expect(registry).toContain("name: 'grants.create'");
    expect(registry).toContain("name: 'grants.update'");
    expect(registry).toContain("name: 'grants.draft_narrative'");
    expect(registry).toContain("name: 'grants.draft_budget'");
  });

  it('registers grants prefix in MCP community tools', () => {
    const mcpCommunity = readProjectFile('lib', 'mcp', 'tools', 'community.ts');

    expect(mcpCommunity).toContain("'grants'");
  });

  it('grants tools use community permission guards', () => {
    const registry = readProjectFile('lib', 'chat', 'community-tool-registry.ts');

    // grants tools declare resource and action for permission checking
    expect(registry).toContain("resource: 'grants'");
    expect(registry).toContain("action: 'view'");
    expect(registry).toContain("action: 'create'");
    expect(registry).toContain("action: 'update'");
  });
});

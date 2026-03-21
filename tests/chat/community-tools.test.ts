import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getCommunityToolCatalog } from '@/lib/chat/community-tool-registry';

function readProjectFile(...segments: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
}

describe('community chat tools', () => {
  it('exposes expanded community CRUD tools to staff users', () => {
    const names = getCommunityToolCatalog('staff').map((tool) => tool.name);

    expect(names).toContain('households.list');
    expect(names).toContain('programs.record_attendance');
    expect(names).toContain('contributions.create');
    expect(names).toContain('assets.update');
    expect(names).toContain('referrals.create');
    expect(names).toContain('relationships.create');
    expect(names).toContain('broadcasts.send');
  });

  it('restricts contractors to their own work tools', () => {
    const names = getCommunityToolCatalog('contractor').map((tool) => tool.name);

    expect(names).toContain('jobs.my_jobs');
    expect(names).toContain('jobs.my_calendar');
    expect(names).toContain('jobs.work_plan');
    expect(names).not.toContain('households.list');
    expect(names).not.toContain('programs.create');
    expect(names).not.toContain('broadcasts.send');
  });

  it('updates the community chat UI metadata for the new tool surface', () => {
    const settings = readProjectFile('components', 'chat', 'chat-settings.tsx');
    const prompt = readProjectFile('lib', 'chat', 'system-prompt.ts');
    const useChat = readProjectFile('hooks', 'use-chat.ts');
    const messageList = readProjectFile('components', 'chat', 'chat-message-list.tsx');

    expect(settings).toContain('ToolGroup name="Households"');
    expect(settings).toContain('ToolGroup name="Broadcasts"');
    expect(prompt).toContain('Households');
    expect(prompt).toContain('Referrals / Relationships / Broadcasts');
    expect(useChat).toContain('programs.record_attendance');
    expect(useChat).toContain('broadcasts.send');
    expect(messageList).toContain('households: {');
    expect(messageList).toContain('broadcasts: {');
  });
});

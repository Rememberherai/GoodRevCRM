import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(...segments: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
}

describe('Community Project Phase 4', () => {
  it('enables a dedicated community chat tool path instead of hard-blocking community projects', () => {
    const route = readProjectFile('app', 'api', 'projects', '[slug]', 'chat', 'route.ts');

    expect(route).toContain("getCommunityToolDefinitions");
    expect(route).toContain("executeCommunityTool");
    expect(route).not.toContain('Chat tools for community projects are not enabled in this phase');
    expect(route).toContain('Community chat tools for this role are not enabled in this phase');
  });

  it('adds community receipt upload support in the chat input and project upload route', () => {
    const input = readProjectFile('components', 'chat', 'chat-input.tsx');
    const uploadRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'community', 'upload', 'route.ts');

    expect(input).toContain('Upload receipt or invoice');
    expect(uploadRoute).toContain("Only receipt images and PDFs are supported");
    expect(uploadRoute).toContain('buildReceiptUploadMessage');
  });

  it('adds the community assistant core modules', () => {
    const ocr = readProjectFile('lib', 'assistant', 'ocr.ts');
    const accounting = readProjectFile('lib', 'assistant', 'accounting-bridge.ts');
    const calendar = readProjectFile('lib', 'assistant', 'calendar-bridge.ts');
    const tools = readProjectFile('lib', 'chat', 'community-tool-registry.ts');

    expect(ocr).toContain('extractReceiptData');
    expect(accounting).toContain('createBill');
    expect(calendar).toContain('syncProgramSession');
    expect(tools).toContain("name: 'receipts.process_image'");
    expect(tools).toContain("name: 'receipts.confirm'");
    expect(tools).toContain("name: 'calendar.sync_program'");
  });

  it('adds QuickBooks OAuth and project secret support', () => {
    const quickbooks = readProjectFile('lib', 'assistant', 'quickbooks.ts');
    const connectRoute = readProjectFile('app', 'api', 'integrations', 'quickbooks', 'connect', 'route.ts');
    const callbackRoute = readProjectFile('app', 'api', 'integrations', 'quickbooks', 'callback', 'route.ts');
    const secrets = readProjectFile('lib', 'secrets.ts');

    expect(quickbooks).toContain('createQBBill');
    expect(quickbooks).toContain("setProjectSecret(projectId, 'quickbooks_access_token', data.access_token, null)");
    expect(connectRoute).toContain('buildQuickBooksConnectUrl');
    expect(connectRoute).toContain('requireCommunityPermission');
    expect(callbackRoute).toContain('requireCommunityPermission');
    expect(callbackRoute).toContain("quickbooks_access_token");
    expect(secrets).toContain('quickbooks_realm_id');
  });

  it('adds the community-specific system prompt and program calendar sync hook', () => {
    const prompt = readProjectFile('lib', 'chat', 'system-prompt.ts');
    const programsRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'programs', 'route.ts');

    expect(prompt).toContain('Receipt Processing');
    expect(prompt).toContain('Calendar Sync');
    expect(programsRoute).toContain('syncProgramSession');
    expect(programsRoute).toContain('calendar_sync');
  });

  it('requires a real receipt source before confirmation and never writes placeholder receipt URLs', () => {
    const tools = readProjectFile('lib', 'chat', 'community-tool-registry.ts');

    expect(tools).toContain('A receipt image or uploaded storage path is required before confirmation');
    expect(tools).not.toContain('example.invalid/receipt');
    expect(tools).toContain('This project does not have an accounting target configured yet');
  });
});

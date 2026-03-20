import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractReceiptData } from '@/lib/assistant/ocr';
import { getProjectSecret } from '@/lib/secrets';

vi.mock('@/lib/secrets', () => ({
  getProjectSecret: vi.fn(),
}));

describe('receipt OCR', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.mocked(getProjectSecret).mockReset();
    global.fetch = vi.fn() as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('extracts receipt fields from an uploaded image source', async () => {
    vi.mocked(getProjectSecret).mockResolvedValue('test-openrouter-key');

    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                vendor: 'Home Depot',
                amount: 47.23,
                receipt_date: '2026-03-18',
                description: 'Garden supplies',
                account_code: '5400',
                class_name: 'Youth Programs',
                line_items: [{ description: 'Planter soil', amount: 47.23 }],
              }),
            },
          },
        ],
      }), { status: 200 }));

    const result = await extractReceiptData({
      projectId: 'project-1',
      imageUrl: 'https://example.com/receipt.png',
      contentType: 'image/png',
      userContext: 'Garden supplies for spring planting',
    });

    expect(result.vendor).toBe('Home Depot');
    expect(result.amount).toBe(47.23);
    expect(result.account_code).toBe('5400');
    expect(result.class_name).toBe('Youth Programs');
  });

  it('fails when the project does not have an OpenRouter key configured', async () => {
    vi.mocked(getProjectSecret).mockResolvedValue(null);
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    }));

    await expect(extractReceiptData({
      projectId: 'project-1',
      imageUrl: 'https://example.com/receipt.png',
      contentType: 'image/png',
    })).rejects.toThrow('OpenRouter API key not configured for this project');
  });
});


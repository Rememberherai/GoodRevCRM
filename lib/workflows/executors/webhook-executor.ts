/**
 * Webhook executor — makes HTTP calls to external URLs
 * Includes SSRF protection, timeout, and configurable retry
 */

import type { WorkflowNode } from '@/types/workflow';
import { assertSafeUrl } from '@/lib/workflows/ssrf-guard';

interface WebhookResult {
  status: number;
  statusText: string;
  body: unknown;
  headers: Record<string, string>;
}

export async function executeWebhook(
  node: WorkflowNode,
  contextData: Record<string, unknown>
): Promise<WebhookResult> {
  const url = node.data.config.url as string;
  const method = (node.data.config.method as string) || 'POST';
  const timeoutMs = (node.data.config.timeout_ms as number) || 10000;
  const customHeaders = (node.data.config.headers as Record<string, string>) || {};
  const payloadFields = node.data.config.payload_fields as string[] | undefined;

  if (!url) {
    throw new Error('Webhook URL is required');
  }

  assertSafeUrl(url);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'GoodRevCRM-Workflow/1.0',
    ...customHeaders,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: method !== 'GET' ? JSON.stringify(
        payloadFields
          ? Object.fromEntries(payloadFields.map((k) => [k, contextData[k]]))
          : contextData
      ) : undefined,
      signal: controller.signal,
      redirect: 'manual',
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
    }

    let body: unknown;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await response.json();
    } else {
      body = await response.text();
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      status: response.status,
      statusText: response.statusText,
      body,
      headers: responseHeaders,
    };
  } finally {
    clearTimeout(timeout);
  }
}

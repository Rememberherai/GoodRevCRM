import { createAdminClient } from '@/lib/supabase/admin';
import type { McpContext, McpUsageLog, RateLimitResult } from '@/types/mcp';

// In-memory sliding window rate limiter
// Key: `${apiKeyId}:${toolName}`, Value: array of timestamps
const rateLimitWindows = new Map<string, number[]>();

const DEFAULT_RATE_LIMIT_PER_MINUTE = 60;
const DEFAULT_RATE_LIMIT_PER_HOUR = 1000;

/**
 * Check rate limits for a tool invocation.
 */
export function checkRateLimit(
  apiKeyId: string,
  toolName: string,
  limitPerMinute: number = DEFAULT_RATE_LIMIT_PER_MINUTE,
  limitPerHour: number = DEFAULT_RATE_LIMIT_PER_HOUR
): RateLimitResult {
  const key = `${apiKeyId}:${toolName}`;
  const now = Date.now();
  const minuteAgo = now - 60_000;
  const hourAgo = now - 3_600_000;

  // Get or create window
  let timestamps = rateLimitWindows.get(key) ?? [];

  // Prune old entries (older than 1 hour)
  timestamps = timestamps.filter((t) => t > hourAgo);

  // Clean up empty keys to prevent memory leak
  if (timestamps.length === 0) {
    rateLimitWindows.delete(key);
  }

  const minuteCount = timestamps.filter((t) => t > minuteAgo).length;
  const hourCount = timestamps.length;

  if (minuteCount >= limitPerMinute) {
    return {
      allowed: false,
      remaining: 0,
      limit: limitPerMinute,
      resetAt: new Date(timestamps[0]! + 60_000),
    };
  }

  if (hourCount >= limitPerHour) {
    return {
      allowed: false,
      remaining: 0,
      limit: limitPerHour,
      resetAt: new Date(timestamps[0]! + 3_600_000),
    };
  }

  // Record this invocation
  timestamps.push(now);
  rateLimitWindows.set(key, timestamps);

  return {
    allowed: true,
    remaining: limitPerMinute - minuteCount - 1,
    limit: limitPerMinute,
    resetAt: new Date(now + 60_000),
  };
}

/**
 * Log an MCP tool invocation to the database (fire-and-forget).
 */
export function logUsage(
  context: McpContext,
  log: McpUsageLog,
  ipAddress?: string,
  userAgent?: string
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MCP tables not yet in generated types
  const supabase = createAdminClient() as any;

  supabase
    .from('mcp_usage_logs')
    .insert({
      project_id: context.projectId,
      api_key_id: context.apiKeyId,
      tool_name: log.tool_name,
      input_summary: log.input_summary,
      output_summary: log.output_summary,
      status: log.status,
      error_message: log.error_message,
      duration_ms: log.duration_ms,
      ip_address: ipAddress ?? null,
      user_agent: userAgent ?? null,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) console.error('[MCP] Failed to log usage:', error.message);
    })
    .catch((err: Error) => {
      console.error('[MCP] Usage log insert failed:', err.message);
    });
}

/**
 * Redact sensitive fields from tool input params before logging.
 */
export function redactSensitiveParams(
  params: Record<string, unknown>
): Record<string, unknown> {
  const sensitiveKeys = ['password', 'token', 'secret', 'api_key', 'key', 'authorization'];
  const redacted: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(params)) {
    if (sensitiveKeys.some((s) => k.toLowerCase().includes(s))) {
      redacted[k] = '[REDACTED]';
    } else {
      redacted[k] = v;
    }
  }

  return redacted;
}

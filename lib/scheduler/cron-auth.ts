/**
 * Shared cron endpoint authentication.
 *
 * Supports both:
 * 1. Per-project auth: if `?project_id=xxx` is in the URL, looks up
 *    that project's `cron_secret` from `project_secrets` and verifies.
 * 2. Global fallback: checks the `CRON_SECRET` environment variable (backward compatible).
 *
 * Returns true if the request is authorized.
 */

import crypto from 'crypto';
import { getProjectSecret } from '@/lib/secrets';

/** Constant-time string comparison to prevent timing attacks.
 *  Uses HMAC to normalize both inputs to the same length, avoiding
 *  length-leaking early returns.
 */
function safeCompare(a: string, b: string): boolean {
  const key = crypto.randomBytes(32);
  const hmacA = crypto.createHmac('sha256', key).update(a).digest();
  const hmacB = crypto.createHmac('sha256', key).update(b).digest();
  return crypto.timingSafeEqual(hmacA, hmacB);
}

// UUID v4 format validation
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function verifyCronAuth(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;

  const token = authHeader.slice(7);
  if (!token) return false;

  // Check for per-project auth via query param
  const url = new URL(request.url);
  const projectId = url.searchParams.get('project_id');

  if (projectId) {
    // Validate project_id is a proper UUID before using it
    if (!UUID_RE.test(projectId)) return false;

    try {
      const projectSecret = await getProjectSecret(projectId, 'cron_secret');
      if (projectSecret && safeCompare(projectSecret, token)) return true;
    } catch {
      // Fall through to global check
    }
  }

  // Global fallback — reject if CRON_SECRET is not set or empty
  const globalSecret = process.env.CRON_SECRET;
  if (!globalSecret) return false;
  if (safeCompare(globalSecret, token)) return true;

  return false;
}

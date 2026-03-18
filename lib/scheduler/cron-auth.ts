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

import { getProjectSecret } from '@/lib/secrets';

export async function verifyCronAuth(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;

  const token = authHeader.slice(7);
  if (!token) return false;

  // Check for per-project auth via query param
  const url = new URL(request.url);
  const projectId = url.searchParams.get('project_id');

  if (projectId) {
    try {
      const projectSecret = await getProjectSecret(projectId, 'cron_secret');
      if (projectSecret && projectSecret === token) return true;
    } catch {
      // Fall through to global check
    }
  }

  // Global fallback
  const globalSecret = process.env.CRON_SECRET;
  if (globalSecret && globalSecret === token) return true;

  return false;
}

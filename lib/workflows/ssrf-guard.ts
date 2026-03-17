/**
 * Shared SSRF protection for all outbound HTTP calls from workflow executors
 * and API connection testing endpoints.
 */

// Block private/internal IP ranges and dangerous hostnames
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,       // Link-local (AWS metadata)
  /^\[::1\]/,          // IPv6 loopback
  /^\[fc/,             // IPv6 private
  /^\[fd/,             // IPv6 private
  /^\[fe80/,           // IPv6 link-local
  /^metadata\./i,      // Common cloud metadata aliases
  /^internal\./i,
];

/**
 * Returns true if the URL points to an internal/private address.
 * Call this before making any server-side fetch to user-controlled URLs.
 */
export function isBlockedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Block non-http(s) schemes
    if (!['http:', 'https:'].includes(parsed.protocol)) return true;
    return BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname));
  } catch {
    return true; // Invalid URL = blocked
  }
}

/**
 * Validates a URL is safe for server-side fetch. Throws if blocked.
 */
export function assertSafeUrl(url: string): void {
  if (isBlockedUrl(url)) {
    throw new Error('URL points to a blocked internal address');
  }
}

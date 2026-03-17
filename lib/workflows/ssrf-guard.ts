/**
 * Shared SSRF protection for all outbound HTTP calls from workflow executors
 * and API connection testing endpoints.
 */

// Block private/internal IP ranges and dangerous hostnames
// NOTE: URL.hostname strips brackets from IPv6, so we match without brackets
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,              // Link-local (AWS metadata)
  /^::1$/,                    // IPv6 loopback (URL.hostname strips brackets)
  /^::$/,                     // IPv6 unspecified
  /^::ffff:127\./,            // IPv4-mapped IPv6 loopback
  /^::ffff:10\./,             // IPv4-mapped IPv6 private
  /^::ffff:172\.(1[6-9]|2[0-9]|3[01])\./,
  /^::ffff:192\.168\./,
  /^::ffff:169\.254\./,
  /^fc/i,                     // IPv6 unique-local (fc00::/7)
  /^fd/i,                     // IPv6 unique-local
  /^fe80/i,                   // IPv6 link-local
  /^metadata\./i,             // Common cloud metadata aliases
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
    const host = parsed.hostname;
    if (!host) return true; // Block URLs with no hostname
    if (BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(host))) return true;
    // Block numeric/octal IP encodings (e.g., 2130706433 = 127.0.0.1)
    if (/^\d+$/.test(host)) return true;
    // Block octal IPs (e.g., 0177.0.0.1)
    if (/^0\d+\./.test(host)) return true;
    // Block hex-encoded IPs (e.g., 0x7f000001 = 127.0.0.1)
    if (/^0x[0-9a-f]+$/i.test(host)) return true;
    return false;
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

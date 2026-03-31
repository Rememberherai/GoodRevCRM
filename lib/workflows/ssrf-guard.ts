/**
 * Shared SSRF protection for all outbound HTTP calls from workflow executors
 * and API connection testing endpoints.
 *
 * WARNING — DNS rebinding risk:
 * This guard validates the hostname string only. It does NOT resolve DNS before
 * checking the IP. An attacker can register a domain that initially resolves to
 * a public IP (passing this check) then rebind to 169.254.169.254 or another
 * internal address. To fully mitigate this, callers should:
 *   1. Use `redirect: 'manual'` on all fetch() calls so redirects can be
 *      re-validated through assertSafeUrl() before following.
 *   2. Ideally, use a custom fetch wrapper that hooks into DNS resolution
 *      (e.g., via a connect callback or local DNS proxy) to validate the
 *      resolved IP before the connection is established.
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
  /^fc[0-9a-f]*:/i,           // IPv6 unique-local (fc00::/7) — colon required to avoid matching domains like "fcpa.gov"
  /^fd[0-9a-f]*:/i,           // IPv6 unique-local — colon required to avoid matching domains like "fdic.gov"
  /^fe80/i,                   // IPv6 link-local (fe80 never starts a valid domain)
  /^metadata\./i,             // Common cloud metadata aliases
  /^internal\./i,
  /\.local$/i,                // mDNS / local network
  /\.internal$/i,             // Internal TLD
  /\.localhost$/i,            // localhost subdomains
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
    // URL.hostname may keep brackets around IPv6 addresses on some Node versions
    const host = parsed.hostname.replace(/^\[|\]$/g, '');
    if (!host) return true; // Block URLs with no hostname
    if (BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(host))) return true;
    // Block numeric/octal IP encodings (e.g., 2130706433 = 127.0.0.1)
    if (/^\d+$/.test(host)) return true;
    // Block octal IPs (e.g., 0177.0.0.1)
    if (/^0\d+\./.test(host)) return true;
    // Block hex-encoded IPs (e.g., 0x7f000001 = 127.0.0.1)
    if (/^0x[0-9a-f]+$/i.test(host)) return true;
    // Block hex octets (e.g., 0x7f.0x00.0x00.0x01 = 127.0.0.1)
    if (/^0x[0-9a-f]+\./i.test(host)) return true;
    // Block mixed octal/hex notation with dots (e.g., 0177.0.0.01)
    if (/\.\d+$/.test(host) && host.split('.').some((p) => /^0[0-7]+$/.test(p))) return true;
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

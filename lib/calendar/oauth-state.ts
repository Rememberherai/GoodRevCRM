/**
 * HMAC-signed OAuth state for calendar integration.
 *
 * The state parameter in Google OAuth is base64url-encoded JSON with an
 * appended HMAC-SHA256 signature. This prevents tampering with fields like
 * user_id, timestamp, or type that the callback uses for authorization.
 */

import crypto from 'crypto';

export interface OAuthState {
  user_id: string;
  nonce: string;
  timestamp: number;
  type: string;
}

function getSigningKey(): string {
  // Use the Google client secret as HMAC key — it's always available when
  // OAuth is configured and is never sent to the browser.
  const key = process.env.GOOGLE_CLIENT_SECRET;
  if (!key) throw new Error('GOOGLE_CLIENT_SECRET is required for OAuth state signing');
  return key;
}

/**
 * Sign an OAuth state object, returning a single base64url string
 * containing both the payload and HMAC signature.
 */
export function signOAuthState(stateData: OAuthState): string {
  const payload = Buffer.from(JSON.stringify(stateData)).toString('base64url');
  const hmac = crypto.createHmac('sha256', getSigningKey()).update(payload).digest('base64url');
  return `${payload}.${hmac}`;
}

/**
 * Verify and decode an HMAC-signed OAuth state string.
 * Returns the decoded state or null if the signature is invalid.
 */
export function verifyOAuthState(stateParam: string): OAuthState | null {
  const dotIndex = stateParam.lastIndexOf('.');
  if (dotIndex === -1) return null;

  const payload = stateParam.slice(0, dotIndex);
  const signature = stateParam.slice(dotIndex + 1);

  const expectedHmac = crypto.createHmac('sha256', getSigningKey()).update(payload).digest('base64url');

  // Constant-time comparison to prevent timing attacks
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedHmac);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()) as OAuthState;
  } catch {
    return null;
  }
}
